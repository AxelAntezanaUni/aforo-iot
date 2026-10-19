export type Rol = "admin" | "consulta";
export type Sesion = { uid: string; orgId: string; rol: Rol };

// recibe el token y devuelve sus claims, o lanza error si la firma no sirve
export type Verificador = (token: string) => Promise<Record<string, unknown>>;

export async function verificarSesion(header: string | null, verificar: Verificador): Promise<Sesion | null> {
  if (!header || !header.startsWith("Bearer ")) return null;
  let claims: Record<string, unknown>;
  try {
    claims = await verificar(header.slice(7));
  } catch {
    return null;
  }
  const { sub, orgId, rol } = claims;
  if (typeof sub !== "string" || typeof orgId !== "string") return null;
  if (rol !== "admin" && rol !== "consulta") return null;
  return { uid: sub, orgId, rol };
}

export function esAdmin(sesion: Sesion | null): boolean {
  return sesion?.rol === "admin";
}
