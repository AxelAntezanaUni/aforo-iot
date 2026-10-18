import { createHash, randomBytes, timingSafeEqual } from "crypto";

// solo letras minusculas, numeros y guion, asi nadie arma rutas raras en firestore
const ID_VALIDO = /^[a-z0-9-]+$/;

export function generarSecreto(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecreto(secreto: string): string {
  return createHash("sha256").update(secreto).digest("hex");
}

export function armarToken(orgId: string, devId: string, secreto: string): string {
  return `${orgId}.${devId}.${secreto}`;
}

export function leerToken(header: string | null): { orgId: string; devId: string; secreto: string } | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  const partes = header.slice(7).split(".");
  if (partes.length !== 3) return null;
  const [orgId, devId, secreto] = partes;
  if (!ID_VALIDO.test(orgId) || !ID_VALIDO.test(devId) || !secreto) return null;
  return { orgId, devId, secreto };
}

export function hashCoincide(secreto: string, hashGuardado: string): boolean {
  const a = Buffer.from(hashSecreto(secreto), "hex");
  const b = Buffer.from(hashGuardado, "hex");
  // comparo en tiempo constante para no dar pistas por el tiempo de respuesta
  return a.length === b.length && timingSafeEqual(a, b);
}
