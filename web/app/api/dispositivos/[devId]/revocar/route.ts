import { revocar } from "@/lib/servicios/dispositivos";
import { verificarSesion } from "@/lib/servicios/sesion";
import { verificarIdToken } from "@/lib/servicios/verificador";
import { repoDispositivos } from "@/lib/repositorios/dispositivos";

export async function POST(req: Request, { params }: { params: Promise<{ devId: string }> }) {
  const sesion = await verificarSesion(req.headers.get("authorization"), verificarIdToken);
  const r = await revocar(sesion, (await params).devId, repoDispositivos);
  return Response.json(r.body, { status: r.status });
}
