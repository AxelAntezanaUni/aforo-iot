"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "./firebase";

type EstadoSesion = {
  cargando: boolean;
  usuario: User | null;
  orgId: string | null;
  rol: "admin" | "consulta" | null;
};

const INICIAL: EstadoSesion = { cargando: true, usuario: null, orgId: null, rol: null };
const Contexto = createContext<EstadoSesion>(INICIAL);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>(INICIAL);

  useEffect(() => {
    return onAuthStateChanged(auth, async (usuario) => {
      if (!usuario) {
        setEstado({ cargando: false, usuario: null, orgId: null, rol: null });
        return;
      }
      // la organizacion y el rol vienen como claims dentro del token
      const token = await usuario.getIdTokenResult();
      const orgId = typeof token.claims.orgId === "string" ? token.claims.orgId : null;
      const rol = token.claims.rol === "admin" || token.claims.rol === "consulta" ? token.claims.rol : null;
      setEstado({ cargando: false, usuario, orgId, rol });
    });
  }, []);

  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export function useSesion() {
  return useContext(Contexto);
}

export function salir() {
  return signOut(auth);
}
