"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { salir, useSesion } from "@/lib/cliente/sesion";

const ENLACES = [{ href: "/dashboard", texto: "Dashboard", soloAdmin: false }];

export default function Panel({ children }: { children: ReactNode }) {
  const { cargando, usuario, orgId, rol } = useSesion();
  const router = useRouter();
  const ruta = usePathname();

  useEffect(() => {
    if (!cargando && !usuario) router.replace("/login");
  }, [cargando, usuario, router]);

  if (cargando || !usuario) return <p className="p-8 text-sm text-zinc-500">Cargando…</p>;

  if (!orgId || !rol) {
    return (
      <main className="p-8">
        <p className="mb-4 text-sm">Tu cuenta no tiene una organización asignada.</p>
        <button onClick={salir} className="text-sm text-teal-700 underline">Salir</button>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-semibold">Control de aforo</span>
          <nav className="flex gap-3 text-sm">
            {ENLACES.filter((e) => !e.soloAdmin || rol === "admin").map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className={ruta === e.href ? "font-medium text-teal-700" : "text-zinc-600 hover:text-zinc-900"}
              >
                {e.texto}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-zinc-600">
            <span>{usuario.email} · {orgId} · {rol}</span>
            <button onClick={salir} className="text-teal-700 hover:underline">Salir</button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">{children}</main>
    </div>
  );
}
