import { z } from "zod";

const entero = z.number().int().nonnegative();

export const esquemaIngesta = z
  .object({
    latido: z.boolean(),
    cruces: z.array(z.object({ t: entero, dir: z.enum(["entra", "sale"]), aforo: entero })).max(400),
    minutos: z
      .array(
        z.object({
          minuto: z.string().regex(/^\d{12}$/),
          t: entero,
          entradas: entero,
          salidas: entero,
          aforoFin: entero,
          aforoMax: entero,
        }),
      )
      .max(400),
    estado: z.object({ t: entero, aforo: entero, entradasHoy: entero, salidasHoy: entero }).nullable(),
    alertas: z
      .array(z.object({ t: entero, tipo: z.literal("capacidad"), aforo: entero, capacidad: entero }))
      .max(20),
  })
  // un batch de firestore aguanta 500 operaciones, dejo margen
  .refine((l) => l.cruces.length + l.minutos.length + l.alertas.length <= 440, {
    message: "lote demasiado grande",
  });

export type Ingesta = z.infer<typeof esquemaIngesta>;
