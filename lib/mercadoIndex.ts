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
  pujaMaximaRentable: number | null;
  sinRentabilidad: boolean;
  valorMax30d: number | null;
  valorMin30d: number | null;
};

export type MercadoIndex = {
  fuente: string;
  actualizadoEn: string;
  totalJugadores: number;
  jugadores: JugadorMercado[];
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Carga public/mercado.json (generado por scripts/scrape-mercado.mjs,
 * refrescado a diario por el workflow de GitHub Actions que reconstruye y
 * republica el sitio). El sitio es estático, así que esto se pide por
 * fetch() al vuelo desde el navegador — no hay servidor detrás.
 */
export async function loadMercadoIndex(): Promise<MercadoIndex> {
  const res = await fetch(`${BASE_PATH}/mercado.json`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`No se pudo cargar el índice de mercado (HTTP ${res.status})`);
  }
  return (await res.json()) as MercadoIndex;
}

export function normalizeName(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
