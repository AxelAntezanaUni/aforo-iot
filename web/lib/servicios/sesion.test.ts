import { describe, it, expect } from "vitest";
import { esAdmin, verificarSesion, Verificador } from "./sesion";

// verificador falso: acepta solo el token "bueno" y devuelve los claims que le pase
function falso(claims: Record<string, unknown>): Verificador {
  return async (token) => {
    if (token !== "bueno") throw new Error("firma invalida");
    return claims;
  };
}

describe("verificarSesion", () => {
  it("devuelve uid, organizacion y rol de un token valido", async () => {
    const s = await verificarSesion("Bearer bueno", falso({ sub: "u1", orgId: "biblioteca", rol: "admin" }));
    expect(s).toEqual({ uid: "u1", orgId: "biblioteca", rol: "admin" });
  });

  it("rechaza sin header o con otro formato", async () => {
    const v = falso({ sub: "u1", orgId: "biblioteca", rol: "admin" });
    expect(await verificarSesion(null, v)).toBeNull();
    expect(await verificarSesion("bueno", v)).toBeNull();
  });

  it("rechaza un token que no pasa la verificacion", async () => {
    expect(await verificarSesion("Bearer malo", falso({ sub: "u1", orgId: "biblioteca", rol: "admin" }))).toBeNull();
  });

  it("rechaza un token sin organizacion o con un rol desconocido", async () => {
    expect(await verificarSesion("Bearer bueno", falso({ sub: "u1", rol: "admin" }))).toBeNull();
    expect(await verificarSesion("Bearer bueno", falso({ sub: "u1", orgId: "biblioteca", rol: "jefe" }))).toBeNull();
  });

  it("solo el rol admin es admin", () => {
    expect(esAdmin({ uid: "u1", orgId: "biblioteca", rol: "admin" })).toBe(true);
    expect(esAdmin({ uid: "u2", orgId: "biblioteca", rol: "consulta" })).toBe(false);
    expect(esAdmin(null)).toBe(false);
  });
});
