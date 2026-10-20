import { describe, it, expect } from "vitest";
import { procesarIngesta, RepoIngesta } from "./ingesta";
import { crearLimitador } from "./limite";
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
    const r = await procesarIngesta(HEADER, lote, repo, { ahora: 1760000000000 });
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

  it("rechaza datos con una hora muy vieja o en el futuro", async () => {
    const { repo, guardados } = repoFalso();
    const ahora = 1760000000000;
    const cruce = (t: number) => ({ ...LATIDO, cruces: [{ t, dir: "entra", aforo: 1 }] });
    // 6 dias atras todavia sirve (datos que quedaron en la cola sin internet)
    expect((await procesarIngesta(HEADER, cruce(ahora - 6 * 86_400_000), repo, { ahora })).status).toBe(200);
    expect((await procesarIngesta(HEADER, cruce(ahora - 8 * 86_400_000), repo, { ahora })).status).toBe(400);
    expect((await procesarIngesta(HEADER, cruce(ahora + 2 * 3_600_000), repo, { ahora })).status).toBe(400);
    const estadoMalo = { ...LATIDO, estado: { t: 9e15, aforo: 1, entradasHoy: 1, salidasHoy: 0 } };
    expect((await procesarIngesta(HEADER, estadoMalo, repo, { ahora })).status).toBe(400);
    expect(guardados).toHaveLength(1);
  });

  it("corta por ip antes de leer firestore", async () => {
    const { repo } = repoFalso();
    let lecturas = 0;
    const contado = { ...repo, leerTokenHash: async (o: string, d: string) => (lecturas++, repo.leerTokenHash(o, d)) };
    const limites = { porIp: crearLimitador(2, 60_000), porDispositivo: crearLimitador(100, 60_000) };
    const falso = "Bearer " + armarToken("biblioteca", "puerta-1", "inventado");
    const estados = [];
    for (let i = 0; i < 4; i++) estados.push((await procesarIngesta(falso, LATIDO, contado, { ip: "1.2.3.4", limites })).status);
    expect(estados).toEqual([401, 401, 429, 429]);
    expect(lecturas).toBe(2);
    // otra ip no se ve afectada
    expect((await procesarIngesta(HEADER, LATIDO, contado, { ip: "5.6.7.8", limites })).status).toBe(200);
  });

  it("corta un dispositivo que manda demasiados pedidos", async () => {
    const { repo, guardados } = repoFalso();
    const limites = { porIp: crearLimitador(100, 60_000), porDispositivo: crearLimitador(3, 60_000) };
    const estados = [];
    for (let i = 0; i < 5; i++) estados.push((await procesarIngesta(HEADER, LATIDO, repo, { ahora: i * 1000, limites })).status);
    expect(estados).toEqual([200, 200, 200, 429, 429]);
    expect(guardados).toHaveLength(3);
    // al minuto siguiente vuelve a pasar
    expect((await procesarIngesta(HEADER, LATIDO, repo, { ahora: 61_000, limites })).status).toBe(200);
  });

  it("acepta el dato de los dos sensores en cada cruce y sigue aceptando cruces sin el", async () => {
    const { repo, guardados } = repoFalso();
    const ahora = 1760000000000;
    const conDt = { ...LATIDO, cruces: [{ t: ahora, dir: "entra", aforo: 1, dtMs: 205 }] };
    const sinDt = { ...LATIDO, cruces: [{ t: ahora, dir: "sale", aforo: 0 }] };
    expect((await procesarIngesta(HEADER, conDt, repo, { ahora })).status).toBe(200);
    expect((await procesarIngesta(HEADER, sinDt, repo, { ahora })).status).toBe(200);
    expect(guardados[0].cruces[0].dtMs).toBe(205);
    expect(guardados[1].cruces[0].dtMs).toBeUndefined();
    const raro = { ...LATIDO, cruces: [{ t: ahora, dir: "entra", aforo: 1, dtMs: 99999 }] };
    expect((await procesarIngesta(HEADER, raro, repo, { ahora })).status).toBe(400);
  });
});
