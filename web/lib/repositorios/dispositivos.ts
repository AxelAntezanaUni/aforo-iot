import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase-admin";
import { RepoDispositivos } from "../servicios/dispositivos";
import { ConfigDispositivo } from "../config";

const disp = (orgId: string, devId: string) => db().doc(`orgs/${orgId}/dispositivos/${devId}`);
const secreto = (orgId: string, devId: string) => db().doc(`orgs/${orgId}/secretos/${devId}`);

export const repoDispositivos: RepoDispositivos = {
  async existe(orgId, devId) {
    return (await disp(orgId, devId).get()).exists;
  },

  async crear(orgId, devId, nombre, config, tokenHash) {
    const batch = db().batch();
    batch.set(disp(orgId, devId), {
      nombre,
      config,
      activo: true,
      creado: FieldValue.serverTimestamp(),
      ultimaConexion: null,
    });
    batch.set(secreto(orgId, devId), { tokenHash });
    await batch.commit();
  },

  async guardarTokenHash(orgId, devId, tokenHash) {
    const batch = db().batch();
    batch.set(secreto(orgId, devId), { tokenHash });
    batch.update(disp(orgId, devId), { activo: true });
    await batch.commit();
  },

  async marcarInactivo(orgId, devId) {
    await disp(orgId, devId).update({ activo: false });
  },

  async leerConfig(orgId, devId) {
    const d = await disp(orgId, devId).get();
    return d.exists ? (d.get("config") as ConfigDispositivo) : null;
  },

  async guardarConfig(orgId, devId, config) {
    await disp(orgId, devId).update({ config });
  },
};
