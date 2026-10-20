import { describe, it, expect } from "vitest";
import { crearLimitador, ipDe } from "./limite";

describe("crearLimitador", () => {
  it("deja pasar hasta el maximo dentro de la ventana", () => {
    const pasa = crearLimitador(3, 60_000);
    expect([pasa("a", 0), pasa("a", 10), pasa("a", 20), pasa("a", 30)]).toEqual([true, true, true, false]);
  });

  it("vuelve a dejar pasar cuando termina la ventana", () => {
    const pasa = crearLimitador(1, 60_000);
    expect(pasa("a", 0)).toBe(true);
    expect(pasa("a", 59_999)).toBe(false);
    expect(pasa("a", 60_000)).toBe(true);
  });

  it("cuenta cada clave por separado", () => {
    const pasa = crearLimitador(1, 60_000);
    expect(pasa("a", 0)).toBe(true);
    expect(pasa("b", 0)).toBe(true);
    expect(pasa("a", 1)).toBe(false);
  });

  it("no guarda claves sin limite", () => {
    const pasa = crearLimitador(1, 60_000, 2);
    pasa("a", 0);
    pasa("b", 0);
    // al llegar una tercera clave se limpia todo, y "a" vuelve a partir de cero
    pasa("c", 0);
    expect(pasa("a", 1)).toBe(true);
  });
});

describe("ipDe", () => {
  it("usa el primer valor de x-forwarded-for", () => {
    expect(ipDe(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });

  it("si no viene, usa x-real-ip o un valor fijo", () => {
    expect(ipDe(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(ipDe(new Headers())).toBe("desconocida");
  });
});
