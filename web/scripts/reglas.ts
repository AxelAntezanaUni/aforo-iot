// publica firestore.rules en el proyecto usando la cuenta de servicio
import { readFileSync } from "fs";
import { getSecurityRules } from "firebase-admin/security-rules";
import { db } from "../lib/firebase-admin";

async function main() {
  // llamo a db() solo para que se inicialice la app con las credenciales
  db();
  const fuente = readFileSync("firestore.rules", "utf8");
  const ruleset = await getSecurityRules().releaseFirestoreRulesetFromSource(fuente);
  console.log("reglas publicadas:", ruleset.name);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
