import { getAuth } from "firebase-admin/auth";
import { iniciar } from "./firebase-admin";

// va aparte porque auth arrastra dependencias que la ruta de ingesta no necesita
export function authAdmin() {
  return getAuth(iniciar());
}
