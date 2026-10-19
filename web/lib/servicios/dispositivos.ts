import { CONFIG_INICIAL, ConfigDispositivo } from "../config";
import { esquemaAlta, esquemaCambioConfig } from "../validacion/config";
import { Respuesta } from "./ingesta";
import { esAdmin, Sesion } from "./sesion";
import { armarToken, generarSecreto, hashSecreto } from "./token";

export type RepoDispositivos = {
  existe(orgId: string, devId: string): Promise<boolean>;
  crear(orgId: string, devId: string, nombre: string, config: ConfigDispositivo, tokenHash: string): Promise<void>;
  guardarTokenHash(orgId: string, devId: string, tokenHash: string): Promise<void>;
  marcarInactivo(orgId: string, devId: string): Promise<void>;
  leerConfig(orgId: string, devId: string): Promise<ConfigDispositivo | null>;
  guardarConfig(orgId: string, devId: string, config: ConfigDispositivo): Promise<void>;
};

const SIN_PERMISO: Respuesta = { status: 403, body: { error: "solo un administrador puede hacer esto" } };
const NO_EXISTE: Respuesta = { status: 404, body: { error: "el dispositivo no existe" } };
const ID_VALIDO = /^[a-z0-9-]{3,30}$/;

export async function crearDispositivo(sesion: Sesion | null, cuerpo: unknown, repo: RepoDispositivos): Promise<Respuesta> {
  if (!sesion || !esAdmin(sesion)) return SIN_PERMISO;
  const alta = esquemaAlta.safeParse(cuerpo);
  if (!alta.success) return { status: 400, body: { error: "id o nombre invalido" } };
  const { devId, nombre } = alta.data;
  if (await repo.existe(sesion.orgId, devId)) return { status: 409, body: { error: "ya existe un dispositivo con ese id" } };
  const secreto = generarSecreto();
  await repo.crear(sesion.orgId, devId, nombre, CONFIG_INICIAL, hashSecreto(secreto));
  // el token solo se muestra ahora, en firestore queda el hash
  return { status: 201, body: { token: armarToken(sesion.orgId, devId, secreto) } };
}

export async function regenerarToken(sesion: Sesion | null, devId: string, repo: RepoDispositivos): Promise<Respuesta> {
  if (!sesion || !esAdmin(sesion)) return SIN_PERMISO;
  if (!ID_VALIDO.test(devId) || !(await repo.existe(sesion.orgId, devId))) return NO_EXISTE;
  const secreto = generarSecreto();
  await repo.guardarTokenHash(sesion.orgId, devId, hashSecreto(secreto));
  return { status: 200, body: { token: armarToken(sesion.orgId, devId, secreto) } };
}

export async function revocar(sesion: Sesion | null, devId: string, repo: RepoDispositivos): Promise<Respuesta> {
  if (!sesion || !esAdmin(sesion)) return SIN_PERMISO;
  if (!ID_VALIDO.test(devId) || !(await repo.existe(sesion.orgId, devId))) return NO_EXISTE;
  await repo.marcarInactivo(sesion.orgId, devId);
  return { status: 200, body: { ok: true } };
}

export async function cambiarConfig(sesion: Sesion | null, devId: string, cuerpo: unknown, repo: RepoDispositivos): Promise<Respuesta> {
  if (!sesion || !esAdmin(sesion)) return SIN_PERMISO;
  if (!ID_VALIDO.test(devId)) return NO_EXISTE;
  const cambios = esquemaCambioConfig.safeParse(cuerpo);
  if (!cambios.success) return { status: 400, body: { error: "configuracion invalida", detalle: cambios.error.issues } };
  const actual = await repo.leerConfig(sesion.orgId, devId);
  if (!actual) return NO_EXISTE;
  const config = { ...actual, ...cambios.data };
  await repo.guardarConfig(sesion.orgId, devId, config);
  return { status: 200, body: { config } };
}
