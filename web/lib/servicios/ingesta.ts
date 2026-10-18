import { ConfigDispositivo } from "../config";
import { esquemaIngesta, Ingesta } from "../validacion/ingesta";
import { hashCoincide, leerToken } from "./token";

// el repo se pasa como parametro para poder probar sin firestore
export type RepoIngesta = {
  leerTokenHash(orgId: string, devId: string): Promise<string | null>;
  leerDispositivo(orgId: string, devId: string): Promise<{ activo: boolean; config: ConfigDispositivo } | null>;
  guardarLote(orgId: string, devId: string, lote: Ingesta): Promise<void>;
};

export type Respuesta = { status: number; body: Record<string, unknown> };

export async function procesarIngesta(header: string | null, cuerpo: unknown, repo: RepoIngesta): Promise<Respuesta> {
  const token = leerToken(header);
  if (!token) return { status: 401, body: { error: "token invalido" } };

  const hash = await repo.leerTokenHash(token.orgId, token.devId);
  if (!hash || !hashCoincide(token.secreto, hash)) return { status: 401, body: { error: "token invalido" } };

  const disp = await repo.leerDispositivo(token.orgId, token.devId);
  if (!disp || !disp.activo) return { status: 401, body: { error: "dispositivo revocado" } };

  const lote = esquemaIngesta.safeParse(cuerpo);
  if (!lote.success) return { status: 400, body: { error: "lote invalido", detalle: lote.error.issues } };

  await repo.guardarLote(token.orgId, token.devId, lote.data);
  return { status: 200, body: { ok: true, config: disp.config } };
}
