import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase-admin";
import { RepoHistorico } from "../servicios/historico";

export const repoHistorico: RepoHistorico = {
  async leer(orgId, devId, inicio, fin) {
    const disp = db().doc(`orgs/${orgId}/dispositivos/${devId}`);
    const desde = Timestamp.fromMillis(inicio);
    const hasta = Timestamp.fromMillis(fin);
    // leo las dos colecciones porque la medicion pasa del modo evento al modo minuto
    const [cruces, minutos] = await Promise.all([
      disp.collection("cruces").where("t", ">=", desde).where("t", "<", hasta).get(),
      disp.collection("minutos").where("t", ">=", desde).where("t", "<", hasta).get(),
    ]);
    return {
      cruces: cruces.docs.map((d) => ({ t: d.get("t").toMillis(), dir: d.get("dir") })),
      minutos: minutos.docs.map((d) => ({
        t: d.get("t").toMillis(),
        entradas: d.get("entradas"),
        salidas: d.get("salidas"),
      })),
    };
  },
};
