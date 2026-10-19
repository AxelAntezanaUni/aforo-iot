import { describe, it, expect } from "vitest";
import { agruparPorHora, obtenerHistorico, RepoHistorico, validarRango } from "./historico";

// en octubre de 2026 chile esta en UTC-3
const chile = (dia: number, h: number, m = 0) => Date.UTC(2026, 9, dia, h + 3, m);

describe("validarRango", () => {
  it("convierte un dia a su inicio y fin en hora de chile", () => {
    expect(validarRango("2026-10-21", "2026-10-21")).toEqual({ inicio: chile(21, 0), fin: chile(22, 0) });
  });

  it("acepta hasta 7 dias", () => {
    expect(validarRango("2026-10-21", "2026-10-27")).toEqual({ inicio: chile(21, 0), fin: chile(28, 0) });
  });

  it("rechaza rangos al reves, mas largos que 7 dias o con formato malo", () => {
    expect(validarRango("2026-10-22", "2026-10-21")).toBeNull();
    expect(validarRango("2026-10-21", "2026-10-28")).toBeNull();
    expect(validarRango("21-10-2026", "2026-10-21")).toBeNull();
    expect(validarRango("2026-10-21", "")).toBeNull();
  });
});

describe("agruparPorHora", () => {
  const rango = { inicio: chile(21, 0), fin: chile(22, 0) };

  it("devuelve las 24 horas del dia aunque esten vacias", () => {
    const horas = agruparPorHora([], [], rango.inicio, rango.fin);
    expect(horas).toHaveLength(24);
    expect(horas[0]).toEqual({ hora: "2026-10-21 00", entradas: 0, salidas: 0 });
    expect(horas[23].hora).toBe("2026-10-21 23");
  });

  it("suma cruces sueltos y minutos agregados en su hora local", () => {
    const cruces = [
      { t: chile(21, 10, 15), dir: "entra" as const },
      { t: chile(21, 10, 40), dir: "sale" as const },
    ];
    const minutos = [
      { t: chile(21, 11, 0), entradas: 3, salidas: 1 },
      { t: chile(21, 11, 59), entradas: 2, salidas: 0 },
    ];
    const horas = agruparPorHora(cruces, minutos, rango.inicio, rango.fin);
    expect(horas[10]).toEqual({ hora: "2026-10-21 10", entradas: 1, salidas: 1 });
    expect(horas[11]).toEqual({ hora: "2026-10-21 11", entradas: 5, salidas: 1 });
    expect(horas[12].entradas).toBe(0);
  });

  it("ignora datos fuera del rango", () => {
    const horas = agruparPorHora([{ t: chile(22, 1, 0), dir: "entra" }], [], rango.inicio, rango.fin);
    expect(horas.reduce((s, h) => s + h.entradas, 0)).toBe(0);
  });
});

describe("obtenerHistorico", () => {
  const sesion = { uid: "u1", orgId: "biblioteca", rol: "consulta" as const };
  const pedidos: string[] = [];
  const repo: RepoHistorico = {
    async leer(orgId, devId) {
      pedidos.push(`${orgId}/${devId}`);
      return {
        cruces: [{ t: chile(21, 9, 5), dir: "entra" }],
        minutos: [{ t: chile(21, 18, 0), entradas: 4, salidas: 2 }],
      };
    },
  };

  it("exige sesion", async () => {
    expect((await obtenerHistorico(null, { devId: "puerta-1", desde: "2026-10-21", hasta: "2026-10-21" }, repo)).status).toBe(401);
  });

  it("rechaza un rango o un dispositivo invalido", async () => {
    expect((await obtenerHistorico(sesion, { devId: "puerta-1", desde: "2026-10-21", hasta: "2026-10-30" }, repo)).status).toBe(400);
    expect((await obtenerHistorico(sesion, { devId: "../x", desde: "2026-10-21", hasta: "2026-10-21" }, repo)).status).toBe(400);
  });

  it("lee solo de la organizacion de la sesion y calcula totales y hora punta", async () => {
    const r = await obtenerHistorico(sesion, { devId: "puerta-1", desde: "2026-10-21", hasta: "2026-10-21" }, repo);
    expect(r.status).toBe(200);
    expect(pedidos.at(-1)).toBe("biblioteca/puerta-1");
    expect(r.body.totalEntradas).toBe(5);
    expect(r.body.totalSalidas).toBe(2);
    expect(r.body.horaPunta).toBe("2026-10-21 18");
    expect(r.body.horas).toHaveLength(24);
  });
});
