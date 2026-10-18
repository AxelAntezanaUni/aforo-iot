import { describe, it, expect } from "vitest";
import { armarToken, generarSecreto, hashCoincide, hashSecreto, leerToken } from "./token";

describe("token del dispositivo", () => {
  it("genera secretos largos y sin puntos", () => {
    const s = generarSecreto();
    expect(s.length).toBeGreaterThanOrEqual(43);
    expect(s).not.toContain(".");
    expect(generarSecreto()).not.toBe(s);
  });

  it("lee un token bien formado", () => {
    const header = "Bearer " + armarToken("biblioteca", "puerta-1", "abc_DEF-123");
    expect(leerToken(header)).toEqual({ orgId: "biblioteca", devId: "puerta-1", secreto: "abc_DEF-123" });
  });

  it("rechaza tokens mal formados", () => {
    expect(leerToken(null)).toBeNull();
    expect(leerToken("biblioteca.puerta-1.abc")).toBeNull();
    expect(leerToken("Bearer biblioteca.puerta-1")).toBeNull();
    expect(leerToken("Bearer biblioteca..abc")).toBeNull();
    // un id con barra podria apuntar a otra coleccion
    expect(leerToken("Bearer biblioteca.puerta-1/x.abc")).toBeNull();
  });

  it("compara el secreto con el hash guardado", () => {
    const hash = hashSecreto("mi-secreto");
    expect(hashCoincide("mi-secreto", hash)).toBe(true);
    expect(hashCoincide("otro", hash)).toBe(false);
    expect(hashCoincide("mi-secreto", "abc")).toBe(false);
  });
});
