import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app: App | undefined;

// inicializo recien cuando se usa, asi el build no necesita las credenciales
function iniciar(): App {
  if (!app) {
    app =
      getApps()[0] ??
      initializeApp({
        // las credenciales vienen de variables de entorno, nunca del repo
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
  }
  return app;
}

export function db() {
  return getFirestore(iniciar());
}

export function authAdmin() {
  return getAuth(iniciar());
}
