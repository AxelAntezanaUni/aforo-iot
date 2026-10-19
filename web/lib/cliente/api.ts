import { auth } from "./firebase";

// llama a la api con el token de la sesion en el header
export async function llamarApi<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const r = await fetch(ruta, {
    ...opciones,
    headers: { ...opciones.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error ?? `error ${r.status}`);
  return datos as T;
}
