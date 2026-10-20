import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase-admin";
import { RepoIngesta } from "../servicios/ingesta";
import { ConfigDispositivo } from "../config";

export const repoIngesta: RepoIngesta = {
  async leerTokenHash(orgId, devId) {
    const doc = await db().doc(`orgs/${orgId}/secretos/${devId}`).get();
    return doc.exists ? (doc.get("tokenHash") as string) : null;
  },

  async leerDispositivo(orgId, devId) {
    const doc = await db().doc(`orgs/${orgId}/dispositivos/${devId}`).get();
    if (!doc.exists) return null;
    return { activo: doc.get("activo") === true, config: doc.get("config") as ConfigDispositivo };
  },

  async guardarLote(orgId, devId, lote) {
    const fs = db();
    const disp = fs.doc(`orgs/${orgId}/dispositivos/${devId}`);
    const batch = fs.batch();
    // los ids salen de la hora, asi un reenvio sobrescribe en vez de duplicar
    for (const c of lote.cruces) {
      batch.set(disp.collection("cruces").doc(String(c.t)), {
        dir: c.dir,
        aforo: c.aforo,
        t: Timestamp.fromMillis(c.t),
        ...(c.dtMs !== undefined && { dtMs: c.dtMs }),
      });
    }
    for (const m of lote.minutos) {
      batch.set(disp.collection("minutos").doc(m.minuto), {
        entradas: m.entradas,
        salidas: m.salidas,
        aforoFin: m.aforoFin,
        aforoMax: m.aforoMax,
        t: Timestamp.fromMillis(m.t),
      });
    }
    if (lote.estado) {
      batch.set(fs.doc(`orgs/${orgId}/estado/${devId}`), {
        aforo: lote.estado.aforo,
        entradasHoy: lote.estado.entradasHoy,
        salidasHoy: lote.estado.salidasHoy,
        actualizado: Timestamp.fromMillis(lote.estado.t),
      });
    }
    for (const a of lote.alertas) {
      batch.set(fs.doc(`orgs/${orgId}/alertas/${devId}-${a.t}`), {
        devId,
        tipo: a.tipo,
        aforo: a.aforo,
        capacidad: a.capacidad,
        t: Timestamp.fromMillis(a.t),
      });
    }
    // la ultima conexion solo se actualiza con el latido, para no gastar una escritura por envio
    if (lote.latido) batch.update(disp, { ultimaConexion: FieldValue.serverTimestamp() });
    await batch.commit();
  },
};
