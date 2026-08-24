import { readFile } from "node:fs/promises";
import path from "node:path";

export type JugadorMercado = {
  id: string;
  nombre: string;
  nombreNormalizado: string;
  posicion: string | null;
  equipoId: string | null;
  equipo: string | null;
  valor: number | null;
  tendenciaDias: number | null;
  aceleracion: number | null;
  diferencia1d: number | null;
  diferenciaPct1d: number | null;
  diferencia7d: number | null;
  diferenciaPct7d: number | null;
  diferencia30d: number | null;
  diferenciaPct30d: number | null;
  valorHace1d: number | null;
  valorHace7d: number | null;
  valorHace30d: number | null;
};

export type MercadoIndex = {
  fuente: string;
  actualizadoEn: string;
  totalJugadores: number;
  jugadores: JugadorMercado[];
};

let cached: MercadoIndex | null = null;

/**
 * Carga data/mercado.json (generado por scripts/scrape-mercado.mjs,
 * refrescado a diario por el workflow de GitHub Actions). Se cachea en
 * memoria del proceso — en dev/servidor esto vive mientras el proceso esté
 * vivo, que es lo que queremos para no releer el fichero en cada request.
 */
export async function loadMercadoIndex(): Promise<MercadoIndex> {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "mercado.json");
  const raw = await readFile(file, "utf-8");
  cached = JSON.parse(raw) as MercadoIndex;
  return cached;
}

export function normalizeName(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
