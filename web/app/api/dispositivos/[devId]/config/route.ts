import { cambiarConfig } from "@/lib/servicios/dispositivos";
import { verificarSesion } from "@/lib/servicios/sesion";
import { verificarIdToken } from "@/lib/servicios/verificador";
import { repoDispositivos } from "@/lib/repositorios/dispositivos";

export async function PATCH(req: Request, { params }: { params: Promise<{ devId: string }> }) {
  const sesion = await verificarSesion(req.headers.get("authorization"), verificarIdToken);
  const cuerpo = await req.json().catch(() => null);
  const r = await cambiarConfig(sesion, (await params).devId, cuerpo, repoDispositivos);
  return Response.json(r.body, { status: r.status });
}
