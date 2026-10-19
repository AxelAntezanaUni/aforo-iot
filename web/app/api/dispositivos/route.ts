import { crearDispositivo } from "@/lib/servicios/dispositivos";
import { verificarSesion } from "@/lib/servicios/sesion";
import { verificarIdToken } from "@/lib/servicios/verificador";
import { repoDispositivos } from "@/lib/repositorios/dispositivos";

export async function POST(req: Request) {
  const sesion = await verificarSesion(req.headers.get("authorization"), verificarIdToken);
  const cuerpo = await req.json().catch(() => null);
  const r = await crearDispositivo(sesion, cuerpo, repoDispositivos);
  return Response.json(r.body, { status: r.status });
}
