import { describe, it, expect } from "vitest";
import { cambiarConfig, crearDispositivo, regenerarToken, revocar, RepoDispositivos } from "./dispositivos";
import { CONFIG_INICIAL, ConfigDispositivo } from "../config";
import { hashCoincide } from "./token";

const admin = { uid: "a", orgId: "biblioteca", rol: "admin" as const };
const consulta = { uid: "c", orgId: "biblioteca", rol: "consulta" as const };

// repo en memoria: clave "org/dev"
function repoFalso() {
  const disp = new Map<string, { nombre: string; config: ConfigDispositivo; activo: boolean; hash: string }>();
  disp.set("biblioteca/puerta-1", { nombre: "Puerta", config: { ...CONFIG_INICIAL }, activo: true, hash: "x" });
  const repo: RepoDispositivos = {
    async existe(o, d) { return disp.has(`${o}/${d}`); },
    async crear(o, d, nombre, config, hash) { disp.set(`${o}/${d}`, { nombre, config, activo: true, hash }); },
    async guardarTokenHash(o, d, hash) { const x = disp.get(`${o}/${d}`)!; x.hash = hash; x.activo = true; },
    async marcarInactivo(o, d) { disp.get(`${o}/${d}`)!.activo = false; },
    async leerConfig(o, d) { return disp.get(`${o}/${d}`)?.config ?? null; },
    async guardarConfig(o, d, config) { disp.get(`${o}/${d}`)!.config = config; },
  };
  return { repo, disp };
}

describe("gestion de dispositivos", () => {
  it("solo un admin puede hacer cambios", async () => {
    const { repo } = repoFalso();
    expect((await crearDispositivo(consulta, { devId: "puerta-2", nombre: "Otra" }, repo)).status).toBe(403);
    expect((await regenerarToken(consulta, "puerta-1", repo)).status).toBe(403);
    expect((await revocar(null, "puerta-1", repo)).status).toBe(403);
    expect((await cambiarConfig(consulta, "puerta-1", { capacidad: 5 }, repo)).status).toBe(403);
  });

  it("crea un dispositivo con la config inicial y devuelve su token una vez", async () => {
    const { repo, disp } = repoFalso();
    const r = await crearDispositivo(admin, { devId: "puerta-2", nombre: "Puerta de atrás" }, repo);
    expect(r.status).toBe(201);
    const token = r.body.token as string;
    expect(token.startsWith("biblioteca.puerta-2.")).toBe(true);
    const guardado = disp.get("biblioteca/puerta-2")!;
    expect(guardado.config).toEqual(CONFIG_INICIAL);
    expect(hashCoincide(token.split(".")[2], guardado.hash)).toBe(true);
  });

  it("no crea ids invalidos ni repetidos", async () => {
    const { repo } = repoFalso();
    expect((await crearDispositivo(admin, { devId: "Puerta 2", nombre: "x" }, repo)).status).toBe(400);
    expect((await crearDispositivo(admin, { devId: "puerta-3", nombre: "" }, repo)).status).toBe(400);
    expect((await crearDispositivo(admin, { devId: "puerta-1", nombre: "x" }, repo)).status).toBe(409);
  });

  it("un token nuevo reemplaza al anterior y reactiva el dispositivo", async () => {
    const { repo, disp } = repoFalso();
    await revocar(admin, "puerta-1", repo);
    expect(disp.get("biblioteca/puerta-1")!.activo).toBe(false);
    const r = await regenerarToken(admin, "puerta-1", repo);
    expect(r.status).toBe(200);
    expect(disp.get("biblioteca/puerta-1")!.activo).toBe(true);
    expect(hashCoincide((r.body.token as string).split(".")[2], disp.get("biblioteca/puerta-1")!.hash)).toBe(true);
  });

  it("responde 404 si el dispositivo no existe en la organizacion", async () => {
    const { repo } = repoFalso();
    const otraOrg = { ...admin, orgId: "laboratorio" };
    expect((await revocar(otraOrg, "puerta-1", repo)).status).toBe(404);
    expect((await regenerarToken(admin, "no-existe", repo)).status).toBe(404);
  });

  it("cambia solo los campos enviados y valida los rangos", async () => {
    const { repo, disp } = repoFalso();
    const r = await cambiarConfig(admin, "puerta-1", { modoEnvio: "minuto", sensores: { ir: true, us: false } }, repo);
    expect(r.status).toBe(200);
    const c = disp.get("biblioteca/puerta-1")!.config;
    expect(c.modoEnvio).toBe("minuto");
    expect(c.sensores).toEqual({ ir: true, us: false });
    expect(c.capacidad).toBe(CONFIG_INICIAL.capacidad);
    expect((await cambiarConfig(admin, "puerta-1", { capacidad: 0 }, repo)).status).toBe(400);
    expect((await cambiarConfig(admin, "puerta-1", { latidoSeg: 5 }, repo)).status).toBe(400);
    expect((await cambiarConfig(admin, "puerta-1", { otraCosa: 1 }, repo)).status).toBe(400);
    expect((await cambiarConfig(admin, "puerta-1", {}, repo)).status).toBe(400);
  });
});
