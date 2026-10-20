import { z } from "zod";

const entero = z.number().int().nonnegative();

export const esquemaIngesta = z
  .object({
    latido: z.boolean(),
    cruces: z
      .array(
        z.object({
          t: entero,
          dir: z.enum(["entra", "sale"]),
          aforo: entero,
          // cuanto despues del ir se corto el ultrasonido (opcional para no romper dispositivos viejos)
          dtMs: z.number().int().min(-5000).max(5000).optional(),
        }),
      )
      .max(400),
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

// la cola de la raspberry guarda datos mientras no hay internet, por eso acepto hasta 7 dias hacia atras;
// hacia adelante solo un margen chico por si el reloj de la raspberry esta algo corrido
export const ATRAS_MS = 7 * 24 * 3_600_000;
export const ADELANTE_MS = 3_600_000;

export function horasEnRango(lote: Ingesta, ahora: number): boolean {
  const horas = [
    ...lote.cruces.map((c) => c.t),
    ...lote.minutos.map((m) => m.t),
    ...lote.alertas.map((a) => a.t),
    ...(lote.estado ? [lote.estado.t] : []),
  ];
  return horas.every((t) => t >= ahora - ATRAS_MS && t <= ahora + ADELANTE_MS);
}
