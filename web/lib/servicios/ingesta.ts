import { ConfigDispositivo } from "../config";
import { esquemaIngesta, horasEnRango, Ingesta } from "../validacion/ingesta";
import { crearLimitador, Limitador } from "./limite";
import { hashCoincide, leerToken } from "./token";

// el repo se pasa como parametro para poder probar sin firestore
export type RepoIngesta = {
  leerTokenHash(orgId: string, devId: string): Promise<string | null>;
  leerDispositivo(orgId: string, devId: string): Promise<{ activo: boolean; config: ConfigDispositivo } | null>;
  guardarLote(orgId: string, devId: string, lote: Ingesta): Promise<void>;
};

export type Respuesta = { status: number; body: Record<string, unknown> };

export type Limites = { porIp: Limitador; porDispositivo: Limitador };

// una raspberry normal manda unos 5 pedidos por minuto (16 con la configuracion mas rapida)
const LIMITES: Limites = {
  porIp: crearLimitador(120, 60_000),
  porDispositivo: crearLimitador(30, 60_000),
};

const DEMASIADOS: Respuesta = { status: 429, body: { error: "demasiados pedidos, espera un momento" } };

type Opciones = { ip?: string; ahora?: number; limites?: Limites };

export async function procesarIngesta(
  header: string | null,
  cuerpo: unknown,
  repo: RepoIngesta,
  { ip = "desconocida", ahora = Date.now(), limites = LIMITES }: Opciones = {},
): Promise<Respuesta> {
  // primero por ip: asi un token inventado no gasta una lectura por cada intento
  if (!limites.porIp(ip, ahora)) return DEMASIADOS;

  const token = leerToken(header);
  if (!token) return { status: 401, body: { error: "token invalido" } };

  const hash = await repo.leerTokenHash(token.orgId, token.devId);
  if (!hash || !hashCoincide(token.secreto, hash)) return { status: 401, body: { error: "token invalido" } };

  // con un token robado se podria agotar la cuota diaria de escrituras, por eso tambien limito por dispositivo
  if (!limites.porDispositivo(`${token.orgId}.${token.devId}`, ahora)) return DEMASIADOS;

  const disp = await repo.leerDispositivo(token.orgId, token.devId);
  if (!disp || !disp.activo) return { status: 401, body: { error: "dispositivo revocado" } };

  const lote = esquemaIngesta.safeParse(cuerpo);
  if (!lote.success) return { status: 400, body: { error: "lote invalido", detalle: lote.error.issues } };
  if (!horasEnRango(lote.data, ahora)) return { status: 400, body: { error: "hay datos con una hora fuera de rango" } };

  await repo.guardarLote(token.orgId, token.devId, lote.data);
  return { status: 200, body: { ok: true, config: disp.config } };
}
