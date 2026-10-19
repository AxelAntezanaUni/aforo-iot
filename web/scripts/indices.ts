// crea en firestore los indices de firestore.indexes.json que todavia no existan
import { readFileSync } from "fs";
import { iniciar } from "../lib/firebase-admin";

type Campo = { fieldPath: string; order: string };
type Indice = { collectionGroup: string; queryScope: string; fields: Campo[] };

const PROYECTO = process.env.FIREBASE_PROJECT_ID;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/collectionGroups`;

// dos indices son iguales si tienen la misma coleccion y los mismos campos en el mismo orden
function firma(coleccion: string, campos: Campo[]) {
  return coleccion + ":" + campos.filter((c) => c.fieldPath !== "__name__").map((c) => `${c.fieldPath}-${c.order}`).join(",");
}

async function main() {
  const { access_token } = await iniciar().options.credential!.getAccessToken();
  const headers = { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" };

  const respuesta = await fetch(`${BASE}/-/indexes`, { headers });
  if (respuesta.status === 403) {
    // la cuenta de servicio de firebase no siempre puede administrar indices
    console.log("sin permiso para administrar indices: crealos en la consola de firebase (Firestore > Indices)");
    console.log(readFileSync("firestore.indexes.json", "utf8"));
    return;
  }
  const lista = await respuesta.json();
  const existentes = new Map<string, string>();
  for (const i of lista.indexes ?? []) {
    const coleccion = i.name.split("/collectionGroups/")[1].split("/")[0];
    existentes.set(firma(coleccion, i.fields), i.state);
  }

  const deseados: Indice[] = JSON.parse(readFileSync("firestore.indexes.json", "utf8")).indexes;
  for (const ind of deseados) {
    const f = firma(ind.collectionGroup, ind.fields);
    if (existentes.has(f)) {
      console.log(`ya existe ${f} (${existentes.get(f)})`);
      continue;
    }
    const r = await fetch(`${BASE}/${ind.collectionGroup}/indexes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ queryScope: ind.queryScope, fields: ind.fields }),
    });
    if (r.ok) console.log(`creando ${f}, tarda unos minutos`);
    else if (r.status === 403) console.log(`sin permiso para crear ${f}: crealo en la consola de firebase (Firestore > Indices)`);
    else console.log(`error ${r.status}: ${await r.text()}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
