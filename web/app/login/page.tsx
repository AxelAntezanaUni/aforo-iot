"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/lib/cliente/firebase";
import { useSesion } from "@/lib/cliente/sesion";

const MENSAJES: Record<string, string> = {
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/invalid-email": "El correo no tiene un formato válido.",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento y vuelve a probar.",
  "auth/network-request-failed": "Sin conexión. Revisa tu internet.",
};

export default function Login() {
  const { cargando, usuario } = useSesion();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!cargando && usuario) router.replace("/dashboard");
  }, [cargando, usuario, router]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !clave) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    setEnviando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), clave);
    } catch (err) {
      const codigo = err instanceof FirebaseError ? err.code : "";
      setError(MENSAJES[codigo] ?? "No se pudo iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Control de aforo</h1>
        <p className="mb-6 text-sm text-zinc-500">Ingresa con tu cuenta</p>
        <label className="mb-1 block text-sm font-medium" htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
        <label className="mb-1 block text-sm font-medium" htmlFor="clave">Contraseña</label>
        <input
          id="clave"
          type="password"
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
