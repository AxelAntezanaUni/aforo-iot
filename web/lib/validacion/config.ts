import { z } from "zod";

// rangos razonables para que nadie deje el dispositivo en un estado absurdo
export const esquemaCambioConfig = z
  .object({
    capacidad: z.number().int().min(1).max(1000),
    umbralCm: z.number().int().min(5).max(200),
    ventanaMs: z.number().int().min(200).max(5000),
    modoEnvio: z.enum(["evento", "minuto"]),
    envioSeg: z.number().int().min(5).max(300),
    latidoSeg: z.number().int().min(15).max(900),
    sensores: z.object({ ir: z.boolean(), us: z.boolean() }),
  })
  .partial()
  .strict()
  .refine((c) => Object.keys(c).length > 0, { message: "nada que cambiar" });

export const esquemaAlta = z.object({
  devId: z.string().regex(/^[a-z0-9-]{3,30}$/),
  nombre: z.string().trim().min(1).max(60),
});
