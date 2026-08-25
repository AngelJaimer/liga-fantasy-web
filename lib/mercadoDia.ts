import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { inicioCicloMercado } from "./marketCycle";

const COLECCION = "mercadoDia";

/**
 * Registra que se ha visto a este jugador en el mercado (de una captura
 * subida por cualquiera). Solo guarda el ID del jugador y cuándo — nunca
 * la captura en sí, nunca quién la subió. Se sobrescribe (upsert) por
 * jugador, así que da igual que lo detecten diez personas: un solo
 * documento por jugador con la marca de tiempo más reciente.
 */
export async function marcarVistoEnMercado(jugadorId: string): Promise<void> {
  await setDoc(doc(db, COLECCION, jugadorId), {
    jugadorId,
    ultimaVezVisto: serverTimestamp(),
  });
}

export async function marcarVistosEnMercado(jugadorIds: string[]): Promise<void> {
  await Promise.all(
    jugadorIds.map((id) =>
      marcarVistoEnMercado(id).catch(() => {
        // si falla uno (red, permisos…) no bloquea al resto
      })
    )
  );
}

/**
 * IDs de jugador vistos en el mercado desde el último reinicio (~14:06
 * hora de Nueva York). No hace falta borrar nada al reiniciar: lo de
 * antes del ciclo actual simplemente se ignora al leer.
 */
export async function leerMercadoDeHoy(): Promise<string[]> {
  const desde = Timestamp.fromDate(inicioCicloMercado());
  const q = query(collection(db, COLECCION), where("ultimaVezVisto", ">=", desde));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.id);
}
