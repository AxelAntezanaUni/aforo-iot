import { describe, it, expect } from "vitest";
import { procesarIngesta, RepoIngesta } from "./ingesta";
import { armarToken, hashSecreto } from "./token";
import { CONFIG_INICIAL } from "../config";
import { Ingesta } from "../validacion/ingesta";

const SECRETO = "secreto-de-prueba";
const HEADER = "Bearer " + armarToken("biblioteca", "puerta-1", SECRETO);
const LATIDO = { latido: true, cruces: [], minutos: [], estado: null, alertas: [] };

function repoFalso(activo = true) {
  const guardados: Ingesta[] = [];
  const repo: RepoIngesta = {
    async leerTokenHash(orgId, devId) {
      return orgId === "biblioteca" && devId === "puerta-1" ? hashSecreto(SECRETO) : null;
    },
    async leerDispositivo() {
      return { activo, config: CONFIG_INICIAL };
    },
    async guardarLote(_orgId, _devId, lote) {
      guardados.push(lote);
    },
  };
  return { repo, guardados };
}

describe("procesarIngesta", () => {
  it("acepta un latido y devuelve la configuracion", async () => {
    const { repo, guardados } = repoFalso();
    const r = await procesarIngesta(HEADER, LATIDO, repo);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, config: CONFIG_INICIAL });
    expect(guardados).toHaveLength(1);
  });

  it("guarda cruces, minutos, estado y alertas", async () => {
    const { repo, guardados } = repoFalso();
    const lote = {
      latido: false,
      cruces: [{ t: 1760000000000, dir: "entra", aforo: 1 }],
      minutos: [{ minuto: "202610211000", t: 1760000000000, entradas: 1, salidas: 0, aforoFin: 1, aforoMax: 1 }],
      estado: { t: 1760000000000, aforo: 1, entradasHoy: 1, salidasHoy: 0 },
      alertas: [{ t: 1760000000000, tipo: "capacidad", aforo: 11, capacidad: 10 }],
    };
    const r = await procesarIngesta(HEADER, lote, repo);
    expect(r.status).toBe(200);
    expect(guardados[0]).toEqual(lote);
  });

  it("rechaza sin token o con secreto malo", async () => {
    const { repo, guardados } = repoFalso();
    expect((await procesarIngesta(null, LATIDO, repo)).status).toBe(401);
    const malo = "Bearer " + armarToken("biblioteca", "puerta-1", "otro");
    expect((await procesarIngesta(malo, LATIDO, repo)).status).toBe(401);
    const otroDisp = "Bearer " + armarToken("biblioteca", "puerta-9", SECRETO);
    expect((await procesarIngesta(otroDisp, LATIDO, repo)).status).toBe(401);
    expect(guardados).toHaveLength(0);
  });

  it("rechaza un dispositivo revocado", async () => {
    const { repo, guardados } = repoFalso(false);
    const r = await procesarIngesta(HEADER, LATIDO, repo);
    expect(r.status).toBe(401);
    expect(guardados).toHaveLength(0);
  });

  it("rechaza un lote invalido sin guardar nada", async () => {
    const { repo, guardados } = repoFalso();
    const r = await procesarIngesta(HEADER, { ...LATIDO, cruces: [{ t: 1, dir: "x", aforo: 1 }] }, repo);
    expect(r.status).toBe(400);
    expect(guardados).toHaveLength(0);
  });

  it("rechaza un lote demasiado grande", async () => {
    const { repo } = repoFalso();
    const cruces = Array.from({ length: 300 }, (_, i) => ({ t: i, dir: "entra", aforo: 1 }));
    const minutos = Array.from({ length: 200 }, (_, i) => ({
      minuto: "202610211000", t: i, entradas: 1, salidas: 0, aforoFin: 1, aforoMax: 1,
    }));
    const r = await procesarIngesta(HEADER, { ...LATIDO, cruces, minutos }, repo);
    expect(r.status).toBe(400);
  });
});
