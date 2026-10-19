"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/cliente/firebase";
import { useSesion } from "@/lib/cliente/sesion";

export default function Usuarios() {
  const { orgId, rol } = useSesion();
  const [usuarios, setUsuarios] = useState<{ id: string; email: string; rol: string }[] | null>(null);

  useEffect(() => {
    if (!orgId || rol !== "admin") return;
    // las reglas solo dejan leer esta coleccion al admin de la organizacion
    return onSnapshot(collection(db, `orgs/${orgId}/usuarios`), (s) =>
      setUsuarios(s.docs.map((d) => ({ id: d.id, email: d.get("email"), rol: d.get("rol") }))),
    );
  }, [orgId, rol]);

  if (rol !== "admin") return <p className="text-sm text-zinc-500">Solo los administradores pueden ver esta página.</p>;
  if (!usuarios) return <p className="text-sm text-zinc-500">Cargando…</p>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Usuarios de la organización</h1>
      <table className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white text-sm shadow-sm">
        <thead className="bg-zinc-50 text-left text-zinc-600">
          <tr>
            <th className="px-4 py-2 font-medium">Correo</th>
            <th className="px-4 py-2 font-medium">Rol</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className="border-t border-zinc-100">
              <td className="px-4 py-2">{u.email}</td>
              <td className="px-4 py-2">{u.rol}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
