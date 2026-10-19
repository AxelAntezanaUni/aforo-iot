import { db } from "../lib/firebase-admin";
const hora = (t: any) => (t ? t.toDate().toLocaleTimeString("es-CL", { timeZone: "America/Santiago" }) : null);
async function main() {
  const base = "orgs/biblioteca/dispositivos/puerta-1";
  const d = await db().doc(base).get();
  console.log("ultimaConexion:", hora(d.get("ultimaConexion")));
  const e = await db().doc("orgs/biblioteca/estado/puerta-1").get();
  console.log("estado:", e.exists ? JSON.stringify({ aforo: e.get("aforo"), entradasHoy: e.get("entradasHoy"), salidasHoy: e.get("salidasHoy"), actualizado: hora(e.get("actualizado")) }) : "todavia no existe");
  const c = await db().collection(`${base}/cruces`).orderBy("t", "desc").limit(5).get();
  console.log("ultimos cruces:", c.docs.map((x) => `${hora(x.get("t"))} ${x.get("dir")} aforo=${x.get("aforo")}`));
  const a = await db().collection("orgs/biblioteca/alertas").get();
  console.log("alertas:", a.size);
}
main().then(() => process.exit(0));
