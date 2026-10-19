"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSesion } from "@/lib/cliente/sesion";

export default function Inicio() {
  const { cargando, usuario } = useSesion();
  const router = useRouter();

  useEffect(() => {
    if (!cargando) router.replace(usuario ? "/dashboard" : "/login");
  }, [cargando, usuario, router]);

  return <p className="p-8 text-sm text-zinc-500">Cargando…</p>;
}
