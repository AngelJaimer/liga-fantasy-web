import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// La apiKey de un proyecto Firebase web NO es un secreto — está pensada
// para ir en el bundle del cliente. Lo que de verdad protege los datos son
// las reglas de seguridad de Firestore (ver la consola del proyecto), no
// ocultar esta configuración.
const firebaseConfig = {
  apiKey: "AIzaSyA9PGxW3AVZe9kllCWwN81hqxJXq09C_Ek",
  authDomain: "liga-fantasy-web.firebaseapp.com",
  projectId: "liga-fantasy-web",
  storageBucket: "liga-fantasy-web.firebasestorage.app",
  messagingSenderId: "303807409756",
  appId: "1:303807409756:web:582d2bee824fe9f1ed4099",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
