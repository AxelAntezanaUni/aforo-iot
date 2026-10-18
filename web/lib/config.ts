// configuracion que se edita desde la web y le llega al dispositivo
export type ConfigDispositivo = {
  capacidad: number;
  umbralCm: number;
  ventanaMs: number;
  modoEnvio: "evento" | "minuto";
  envioSeg: number;
  latidoSeg: number;
  sensores: { ir: boolean; us: boolean };
};

export const CONFIG_INICIAL: ConfigDispositivo = {
  capacidad: 10,
  umbralCm: 60,
  ventanaMs: 1500,
  modoEnvio: "evento",
  envioSeg: 15,
  latidoSeg: 60,
  sensores: { ir: true, us: true },
};
