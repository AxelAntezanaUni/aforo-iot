import { procesarIngesta } from "@/lib/servicios/ingesta";
import { repoIngesta } from "@/lib/repositorios/ingesta";

export async function POST(req: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ error: "json invalido" }, { status: 400 });
  }
  const r = await procesarIngesta(req.headers.get("authorization"), cuerpo, repoIngesta);
  return Response.json(r.body, { status: r.status });
}
