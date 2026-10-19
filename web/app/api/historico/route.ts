import { obtenerHistorico } from "@/lib/servicios/historico";
import { verificarSesion } from "@/lib/servicios/sesion";
import { verificarIdToken } from "@/lib/servicios/verificador";
import { repoHistorico } from "@/lib/repositorios/historico";

export async function GET(req: Request) {
  const sesion = await verificarSesion(req.headers.get("authorization"), verificarIdToken);
  const p = new URL(req.url).searchParams;
  const pedido = { devId: p.get("devId") ?? "", desde: p.get("desde") ?? "", hasta: p.get("hasta") ?? "" };
  const r = await obtenerHistorico(sesion, pedido, repoHistorico);
  return Response.json(r.body, { status: r.status });
}
