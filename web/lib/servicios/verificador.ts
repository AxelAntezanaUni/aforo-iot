import { createRemoteJWKSet, jwtVerify } from "jose";

// verifico el token de firebase con las claves publicas de google, sin firebase-admin/auth
// (esa libreria no carga en vercel por un problema de modulos)
const PROYECTO = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "aforo-iot";
const CLAVES = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export async function verificarIdToken(token: string): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(token, CLAVES, {
    issuer: `https://securetoken.google.com/${PROYECTO}`,
    audience: PROYECTO,
  });
  return payload as Record<string, unknown>;
}
