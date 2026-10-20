import { Respuesta } from "./ingesta";
import { Sesion } from "./sesion";
import { crearLimitador, Limitador } from "./limite";

export type Cruce = { t: number; dir: "entra" | "sale" };
export type Minuto = { t: number; entradas: number; salidas: number };
export type Hora = { hora: string; entradas: number; salidas: number };

const ZONA = "America/Santiago";
const HORA_MS = 3_600_000;
const MAX_DIAS = 7;

const formato = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function partes(t: number) {
  return Object.fromEntries(formato.formatToParts(t).map((p) => [p.type, p.value]));
}

// cuanto se adelanta (o atrasa) la hora de chile respecto de utc en ese momento
function desfase(t: number) {
  const p = partes(t);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
}

function inicioDelDia(fecha: string) {
  const [a, m, d] = fecha.split("-").map(Number);
  const utc = Date.UTC(a, m - 1, d);
  return utc - desfase(utc);
}

function claveHora(t: number) {
  const p = partes(t);
  return `${p.year}-${p.month}-${p.day} ${p.hour}`;
}

// desde y hasta son dias "AAAA-MM-DD" incluidos, en hora de chile
export function validarRango(desde: string, hasta: string): { inicio: number; fin: number } | null {
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  if (!fecha.test(desde) || !fecha.test(hasta)) return null;
  const inicio = inicioDelDia(desde);
  const fin = inicioDelDia(hasta) + 24 * HORA_MS;
  const dias = Math.round((fin - inicio) / (24 * HORA_MS));
  if (dias < 1 || dias > MAX_DIAS) return null;
  return { inicio, fin };
}

// junto los cruces (modo evento) y los minutos (modo minuto) en una fila por hora
export function agruparPorHora(cruces: Cruce[], minutos: Minuto[], inicio: number, fin: number): Hora[] {
  const horas = new Map<string, Hora>();
  for (let t = inicio; t < fin; t += HORA_MS) {
    const hora = claveHora(t);
    horas.set(hora, { hora, entradas: 0, salidas: 0 });
  }
  const sumar = (t: number, entradas: number, salidas: number) => {
    if (t < inicio || t >= fin) return;
    const h = horas.get(claveHora(t));
    if (!h) return;
    h.entradas += entradas;
    h.salidas += salidas;
  };
  for (const c of cruces) sumar(c.t, c.dir === "entra" ? 1 : 0, c.dir === "sale" ? 1 : 0);
  for (const m of minutos) sumar(m.t, m.entradas, m.salidas);
  return [...horas.values()];
}

export type RepoHistorico = {
  leer(orgId: string, devId: string, inicio: number, fin: number): Promise<{ cruces: Cruce[]; minutos: Minuto[] }>;
};

type Pedido = { devId: string; desde: string; hasta: string };

// una consulta de 7 dias puede leer miles de documentos, asi que limito cuantas hace cada usuario
const LIMITE: Limitador = crearLimitador(20, 60_000);

export async function obtenerHistorico(
  sesion: Sesion | null,
  pedido: Pedido,
  repo: RepoHistorico,
  limite: Limitador = LIMITE,
  ahora = Date.now(),
): Promise<Respuesta> {
  if (!sesion) return { status: 401, body: { error: "sesion invalida" } };
  if (!limite(sesion.uid, ahora)) return { status: 429, body: { error: "demasiadas consultas, espera un momento" } };
  if (!/^[a-z0-9-]+$/.test(pedido.devId)) return { status: 400, body: { error: "dispositivo invalido" } };
  const rango = validarRango(pedido.desde, pedido.hasta);
  if (!rango) return { status: 400, body: { error: "rango de fechas invalido (maximo 7 dias)" } };

  // la organizacion sale de la sesion, nunca del pedido
  const { cruces, minutos } = await repo.leer(sesion.orgId, pedido.devId, rango.inicio, rango.fin);
  const horas = agruparPorHora(cruces, minutos, rango.inicio, rango.fin);
  const totalEntradas = horas.reduce((s, h) => s + h.entradas, 0);
  const totalSalidas = horas.reduce((s, h) => s + h.salidas, 0);
  const punta = horas.reduce((max, h) => (h.entradas > max.entradas ? h : max), horas[0]);
  return {
    status: 200,
    body: { horas, totalEntradas, totalSalidas, horaPunta: punta && punta.entradas > 0 ? punta.hora : null },
  };
}
