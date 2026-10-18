// crea las organizaciones, las cuentas de prueba y el primer dispositivo
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../lib/firebase-admin";
import { authAdmin } from "../lib/firebase-auth";
import { CONFIG_INICIAL } from "../lib/config";
import { armarToken, generarSecreto, hashSecreto } from "../lib/servicios/token";

const VARIABLES = [
  "SEED_EMAIL_ADMIN", "SEED_CLAVE_ADMIN",
  "SEED_EMAIL_CONSULTA", "SEED_CLAVE_CONSULTA",
  "SEED_EMAIL_LAB", "SEED_CLAVE_LAB",
];

type Cuenta = { email: string; clave: string; orgId: string; rol: "admin" | "consulta" };

async function crearCuenta(c: Cuenta) {
  let uid: string;
  try {
    uid = (await authAdmin().getUserByEmail(c.email)).uid;
  } catch {
    uid = (await authAdmin().createUser({ email: c.email, password: c.clave })).uid;
  }
  // el rol y la organizacion van en el token, asi las reglas no gastan lecturas
  await authAdmin().setCustomUserClaims(uid, { orgId: c.orgId, rol: c.rol });
  await db().doc(`orgs/${c.orgId}/usuarios/${uid}`).set({ email: c.email, rol: c.rol });
  console.log(`cuenta lista: ${c.email} (${c.orgId}, ${c.rol})`);
}

async function main() {
  for (const v of VARIABLES) {
    if (!process.env[v]) throw new Error(`falta ${v} en .env.local`);
  }
  const env = process.env as Record<string, string>;

  await db().doc("orgs/biblioteca").set({ nombre: "Biblioteca" });
  await db().doc("orgs/laboratorio").set({ nombre: "Laboratorio" });

  await crearCuenta({ email: env.SEED_EMAIL_ADMIN, clave: env.SEED_CLAVE_ADMIN, orgId: "biblioteca", rol: "admin" });
  await crearCuenta({ email: env.SEED_EMAIL_CONSULTA, clave: env.SEED_CLAVE_CONSULTA, orgId: "biblioteca", rol: "consulta" });
  await crearCuenta({ email: env.SEED_EMAIL_LAB, clave: env.SEED_CLAVE_LAB, orgId: "laboratorio", rol: "admin" });

  const disp = db().doc("orgs/biblioteca/dispositivos/puerta-1");
  if ((await disp.get()).exists) {
    console.log("puerta-1 ya existe, no toco su token");
    return;
  }
  const secreto = generarSecreto();
  await disp.set({
    nombre: "Puerta principal",
    config: CONFIG_INICIAL,
    activo: true,
    creado: FieldValue.serverTimestamp(),
    ultimaConexion: null,
  });
  await db().doc("orgs/biblioteca/secretos/puerta-1").set({ tokenHash: hashSecreto(secreto) });
  console.log("token de puerta-1 (se muestra una sola vez, va en el .env de la Raspberry):");
  console.log(armarToken("biblioteca", "puerta-1", secreto));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
