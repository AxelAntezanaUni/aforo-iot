"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/cliente/firebase";
import { useSesion } from "@/lib/cliente/sesion";

type Dispositivo = {
  id: string;
  nombre: string;
  activo: boolean;
  ultimaConexion: Timestamp | null;
  config: { capacidad: number; latidoSeg: number; modoEnvio: string };
};
type Estado = { aforo: number; entradasHoy: number; salidasHoy: number; actualizado: Timestamp };
type Alerta = { id: string; devId: string; aforo: number; capacidad: number; t: Timestamp };

function hora(t: Timestamp | null | undefined) {
  return t ? t.toDate().toLocaleTimeString("es-CL") : "—";
}

export default function Dashboard() {
  const { orgId } = useSesion();
  const [dispositivos, setDispositivos] = useState<Dispositivo[] | null>(null);
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [error, setError] = useState("");
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!orgId) return;
    const fallo = () => setError("No se pudieron leer los datos de tu organización.");
    // una suscripcion por coleccion, firestore solo cobra los documentos que cambian
    const cancelar = [
      onSnapshot(
        collection(db, `orgs/${orgId}/dispositivos`),
        (s) => setDispositivos(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Dispositivo, "id">) }))),
        fallo,
      ),
      onSnapshot(
        collection(db, `orgs/${orgId}/estado`),
        (s) => setEstados(Object.fromEntries(s.docs.map((d) => [d.id, d.data() as Estado]))),
        fallo,
      ),
      onSnapshot(
        query(collection(db, `orgs/${orgId}/alertas`), orderBy("t", "desc"), limit(5)),
        (s) => setAlertas(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Alerta, "id">) }))),
        fallo,
      ),
    ];
    return () => cancelar.forEach((c) => c());
  }, [orgId]);

  // recalculo el estado de conexion cada 15 s aunque no lleguen datos
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!dispositivos) return <p className="text-sm text-zinc-500">Cargando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Aforo en tiempo real</h1>

      {dispositivos.length === 0 && (
        <p className="text-sm text-zinc-500">Esta organización todavía no tiene dispositivos.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {dispositivos.map((d) => {
          const e = estados[d.id];
          const aforo = e?.aforo ?? 0;
          const capacidad = d.config.capacidad;
          const porcentaje = Math.min(100, Math.round((aforo / capacidad) * 100));
          const ultima = d.ultimaConexion?.toMillis() ?? 0;
          const enLinea = d.activo && ahora - ultima < 2 * d.config.latidoSeg * 1000;
          const color = aforo > capacidad ? "bg-red-500" : porcentaje >= 80 ? "bg-amber-500" : "bg-teal-600";
          return (
            <section key={d.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-medium">{d.nombre}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    enLinea ? "bg-teal-50 text-teal-800" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {!d.activo ? "revocado" : enLinea ? "en línea" : "sin conexión"}
                </span>
              </div>
              <p className="text-4xl font-semibold">
                {aforo}
                <span className="text-lg font-normal text-zinc-500"> / {capacidad} personas</span>
              </p>
              <div className="mt-3 h-2 w-full rounded-full bg-zinc-100">
                <div className={`h-2 rounded-full ${color}`} style={{ width: `${porcentaje}%` }} />
              </div>
              {aforo > capacidad && <p className="mt-2 text-sm text-red-600">Se superó la capacidad</p>}
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-zinc-500">Entradas hoy</dt>
                  <dd className="font-medium">{e?.entradasHoy ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Salidas hoy</dt>
                  <dd className="font-medium">{e?.salidasHoy ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Último dato</dt>
                  <dd>{hora(e?.actualizado)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Último latido</dt>
                  <dd>{hora(d.ultimaConexion)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-zinc-500">Modo de envío: {d.config.modoEnvio}</p>
            </section>
          );
        })}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-medium">Últimas alertas</h2>
        {alertas.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin alertas.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {alertas.map((a) => (
              <li key={a.id} className="flex justify-between py-2">
                <span>
                  {a.devId}: se superó la capacidad ({a.aforo} de {a.capacidad})
                </span>
                <span className="text-zinc-500">
                  {a.t.toDate().toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
