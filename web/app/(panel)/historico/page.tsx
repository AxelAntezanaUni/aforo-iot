"use client";

import { FormEvent, useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { db } from "@/lib/cliente/firebase";
import { llamarApi } from "@/lib/cliente/api";
import { useSesion } from "@/lib/cliente/sesion";

type Hora = { hora: string; entradas: number; salidas: number };
type Resultado = { horas: Hora[]; totalEntradas: number; totalSalidas: number; horaPunta: string | null };

function hoyEnChile() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

// "2026-10-21 18" -> "18:00" si es un solo dia, o "21/10 18h" si son varios
function etiqueta(hora: string, unDia: boolean) {
  const [fecha, h] = hora.split(" ");
  const [, mes, dia] = fecha.split("-");
  return unDia ? `${h}:00` : `${dia}/${mes} ${h}h`;
}

export default function Historico() {
  const { orgId } = useSesion();
  const [dispositivos, setDispositivos] = useState<{ id: string; nombre: string }[]>([]);
  const [devId, setDevId] = useState("");
  const [desde, setDesde] = useState(hoyEnChile);
  const [hasta, setHasta] = useState(hoyEnChile);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    getDocs(collection(db, `orgs/${orgId}/dispositivos`)).then((s) => {
      const lista = s.docs.map((d) => ({ id: d.id, nombre: d.get("nombre") as string }));
      setDispositivos(lista);
      if (lista.length > 0) setDevId(lista[0].id);
    });
  }, [orgId]);

  async function consultar(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!devId) {
      setError("Elige un dispositivo.");
      return;
    }
    if (desde > hasta) {
      setError("La fecha de inicio no puede ser posterior a la de término.");
      return;
    }
    setCargando(true);
    try {
      const q = new URLSearchParams({ devId, desde, hasta });
      setResultado(await llamarApi<Resultado>(`/api/historico?${q}`));
    } catch (err) {
      setResultado(null);
      setError(err instanceof Error && err.message.includes("rango") ? "El rango puede ser de hasta 7 días." : "No se pudo consultar el histórico.");
    } finally {
      setCargando(false);
    }
  }

  const unDia = desde === hasta;
  const datos = resultado?.horas.map((h) => ({ ...h, etiqueta: etiqueta(h.hora, unDia) })) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Histórico por hora</h1>

      <form onSubmit={consultar} className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Dispositivo</span>
          <select value={devId} onChange={(e) => setDevId(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2">
            {dispositivos.length === 0 && <option value="">Sin dispositivos</option>}
            {dispositivos.map((d) => (
              <option key={d.id} value={d.id}>{d.nombre}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2" />
        </label>
        <button type="submit" disabled={cargando} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {cargando ? "Consultando…" : "Consultar"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {resultado && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <dl className="mb-4 flex flex-wrap gap-6 text-sm">
            <div>
              <dt className="text-zinc-500">Entradas</dt>
              <dd className="text-2xl font-semibold">{resultado.totalEntradas}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Salidas</dt>
              <dd className="text-2xl font-semibold">{resultado.totalSalidas}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Hora punta</dt>
              <dd className="text-2xl font-semibold">{resultado.horaPunta ? etiqueta(resultado.horaPunta, unDia) : "—"}</dd>
            </div>
          </dl>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="etiqueta" fontSize={11} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="#0f766e" />
                <Bar dataKey="salidas" name="Salidas" fill="#a1a1aa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
