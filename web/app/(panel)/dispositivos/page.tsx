"use client";

import { FormEvent, useEffect, useState } from "react";
import { collection, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/cliente/firebase";
import { llamarApi } from "@/lib/cliente/api";
import { useSesion } from "@/lib/cliente/sesion";
import { ConfigDispositivo } from "@/lib/config";

type Dispositivo = { id: string; nombre: string; activo: boolean; ultimaConexion: Timestamp | null; config: ConfigDispositivo };

const CAMPOS: { clave: keyof ConfigDispositivo; texto: string; ayuda: string }[] = [
  { clave: "capacidad", texto: "Capacidad", ayuda: "personas (1-1000)" },
  { clave: "umbralCm", texto: "Umbral ultrasonido", ayuda: "cm (5-200)" },
  { clave: "ventanaMs", texto: "Ventana entre sensores", ayuda: "ms (200-5000)" },
  { clave: "envioSeg", texto: "Envío cada", ayuda: "segundos (5-300)" },
  { clave: "latidoSeg", texto: "Latido cada", ayuda: "segundos (15-900)" },
];

function EditorConfig({ d, onToken }: { d: Dispositivo; onToken: (texto: string) => void }) {
  const [config, setConfig] = useState<ConfigDispositivo>(d.config);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setMensaje("");
    setGuardando(true);
    try {
      await llamarApi(`/api/dispositivos/${d.id}/config`, { method: "PATCH", body: JSON.stringify(config) });
      setMensaje(`Guardado. El dispositivo lo aplica en su próximo envío o latido (máximo ${config.latidoSeg} s).`);
    } catch {
      setMensaje("No se pudo guardar. Revisa que los valores estén dentro de los rangos.");
    } finally {
      setGuardando(false);
    }
  }

  async function nuevoToken() {
    if (!confirm(`¿Generar un token nuevo para ${d.nombre}? El actual deja de funcionar.`)) return;
    const r = await llamarApi<{ token: string }>(`/api/dispositivos/${d.id}/token`, { method: "POST" });
    onToken(r.token);
  }

  async function revocarlo() {
    if (!confirm(`¿Revocar ${d.nombre}? Dejará de poder enviar datos hasta que generes un token nuevo.`)) return;
    await llamarApi(`/api/dispositivos/${d.id}/revocar`, { method: "POST" });
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="font-medium">{d.nombre}</h2>
        <code className="text-xs text-zinc-500">{d.id}</code>
        <span className={`rounded-full px-2 py-0.5 text-xs ${d.activo ? "bg-teal-50 text-teal-800" : "bg-red-50 text-red-700"}`}>
          {d.activo ? "activo" : "revocado"}
        </span>
        <span className="text-xs text-zinc-500">
          último latido: {d.ultimaConexion ? d.ultimaConexion.toDate().toLocaleString("es-CL") : "nunca"}
        </span>
      </div>
      <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-3">
        {CAMPOS.map((c) => (
          <label key={c.clave} className="text-sm">
            <span className="block text-zinc-600">{c.texto}</span>
            <input
              type="number"
              value={config[c.clave] as number}
              onChange={(e) => setConfig({ ...config, [c.clave]: Number(e.target.value) })}
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5"
            />
            <span className="text-xs text-zinc-400">{c.ayuda}</span>
          </label>
        ))}
        <label className="text-sm">
          <span className="block text-zinc-600">Modo de envío</span>
          <select
            value={config.modoEnvio}
            onChange={(e) => setConfig({ ...config, modoEnvio: e.target.value as ConfigDispositivo["modoEnvio"] })}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5"
          >
            <option value="evento">evento (un documento por cruce)</option>
            <option value="minuto">minuto (un documento por minuto)</option>
          </select>
        </label>
        <fieldset className="text-sm sm:col-span-3">
          <legend className="text-zinc-600">Sensores activos</legend>
          <label className="mr-4">
            <input
              type="checkbox"
              checked={config.sensores.ir}
              onChange={(e) => setConfig({ ...config, sensores: { ...config.sensores, ir: e.target.checked } })}
            />{" "}
            Infrarrojo
          </label>
          <label>
            <input
              type="checkbox"
              checked={config.sensores.us}
              onChange={(e) => setConfig({ ...config, sensores: { ...config.sensores, us: e.target.checked } })}
            />{" "}
            Ultrasonido
          </label>
        </fieldset>
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          <button type="submit" disabled={guardando} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar configuración"}
          </button>
          <button type="button" onClick={nuevoToken} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50">
            Generar token nuevo
          </button>
          {d.activo && (
            <button type="button" onClick={revocarlo} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
              Revocar
            </button>
          )}
        </div>
        {mensaje && <p className="text-sm text-zinc-600 sm:col-span-3">{mensaje}</p>}
      </form>
    </section>
  );
}

export default function Dispositivos() {
  const { orgId, rol } = useSesion();
  const [dispositivos, setDispositivos] = useState<Dispositivo[] | null>(null);
  const [nuevoId, setNuevoId] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orgId) return;
    return onSnapshot(collection(db, `orgs/${orgId}/dispositivos`), (s) =>
      setDispositivos(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Dispositivo, "id">) }))),
    );
  }, [orgId]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[a-z0-9-]{3,30}$/.test(nuevoId)) {
      setError("El id debe tener entre 3 y 30 caracteres: minúsculas, números o guion.");
      return;
    }
    if (!nuevoNombre.trim()) {
      setError("Escribe un nombre.");
      return;
    }
    try {
      const r = await llamarApi<{ token: string }>("/api/dispositivos", {
        method: "POST",
        body: JSON.stringify({ devId: nuevoId, nombre: nuevoNombre }),
      });
      setToken(r.token);
      setNuevoId("");
      setNuevoNombre("");
    } catch (err) {
      setError(err instanceof Error && err.message.includes("ya existe") ? "Ya existe un dispositivo con ese id." : "No se pudo crear el dispositivo.");
    }
  }

  if (rol !== "admin") return <p className="text-sm text-zinc-500">Solo los administradores pueden ver esta página.</p>;
  if (!dispositivos) return <p className="text-sm text-zinc-500">Cargando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Dispositivos</h1>

      {token && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="mb-2 font-medium">Token del dispositivo (cópialo ahora, no se vuelve a mostrar):</p>
          <code className="block break-all rounded bg-white p-2 font-mono text-xs">{token}</code>
          <div className="mt-2 flex gap-3">
            <button onClick={() => navigator.clipboard.writeText(token)} className="text-teal-700 hover:underline">Copiar</button>
            <button onClick={() => setToken("")} className="text-zinc-600 hover:underline">Ya lo guardé</button>
          </div>
        </div>
      )}

      {dispositivos.map((d) => (
        <EditorConfig key={d.id} d={d} onToken={setToken} />
      ))}

      <form onSubmit={crear} className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-zinc-300 bg-white p-4">
        <label className="text-sm">
          <span className="block text-zinc-600">Id</span>
          <input value={nuevoId} onChange={(e) => setNuevoId(e.target.value)} placeholder="puerta-2" className="rounded-lg border border-zinc-300 px-3 py-1.5" />
        </label>
        <label className="text-sm">
          <span className="block text-zinc-600">Nombre</span>
          <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Puerta de atrás" className="rounded-lg border border-zinc-300 px-3 py-1.5" />
        </label>
        <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
          Agregar dispositivo
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
