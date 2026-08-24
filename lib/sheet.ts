import Papa from "papaparse";

/**
 * Lee la pestaña "Liga" del Google Sheet de la liga fantasy de los amigos.
 *
 * El Sheet debe estar compartido como "Cualquiera con el enlace: lector"
 * (ya lo está — se comprobó al montar esto). Usamos el endpoint público de
 * exportación CSV de Google Visualization, que no necesita API key ni
 * OAuth para un fichero visible por enlace.
 */

// Se llama desde el navegador (sitio estático), así que tiene que ser una
// env var pública (NEXT_PUBLIC_*) para que Next la incluya en el bundle.
// No es un dato sensible: el propio Sheet ya está compartido como
// "cualquiera con el enlace", así que su ID no protege nada por sí solo.
const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
const GVIZ_BASE = () => {
  if (!SHEET_ID) {
    throw new Error(
      "Falta la variable de entorno NEXT_PUBLIC_GOOGLE_SHEET_ID (el ID del Google Sheet, en la URL entre /d/ y /edit)."
    );
  }
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;
};

export type JugadorPremios = {
  jugador: string;
  eurJornadas: number;
  retoSieteSieteJornada: string | null;
  eurRetoSieteSiete: number;
  mejorPuntuacionJornada: string | null;
  eurMejorPuntuacion: number;
  puestoFinal: string | null;
  eurPuestoFinal: number;
  pagado: boolean;
  totalGanado: number;
  neto: number;
};

function euros(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

function text(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

// Comparación robusta a variantes de normalización Unicode de la tilde
// (Google a veces sirve "í" precompuesta, a veces "i" + acento combinante).
function esSi(v: string | undefined): boolean {
  return (v ?? "").normalize("NFC").trim().toLowerCase() === "sí";
}

async function fetchCsv(range: string, headers: 1 | 3): Promise<string> {
  const params = new URLSearchParams({
    tqx: "out:csv",
    sheet: "Liga",
    range,
    headers: String(headers),
  });
  const res = await fetch(`${GVIZ_BASE()}?${params.toString()}`, {
    // El Sheet se edita a mano en directo durante la temporada — cada visita
    // a la portada debe reflejar el estado actual, así que sin caché.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `No se pudo leer el Google Sheet (HTTP ${res.status}). ¿Sigue compartido como "cualquiera con el enlace"?`
    );
  }
  return res.text();
}

/**
 * Averigua en qué fila está la fila "CONTROL" que cierra la tabla de
 * jugadores, para pedir después solo ese rango exacto.
 *
 * Esto no es cosmético: si el rango que le pedimos a gviz incluye la fila
 * CONTROL, esa fila tiene una fórmula (=COUNTIF(...)) en la columna
 * "Pagado" que devuelve un NÚMERO, mientras que las filas de jugador tienen
 * texto ("Sí"/""). gviz infiere un tipo único por columna a partir de toda
 * la muestra, y si detecta esa mezcla de tipos, vacía silenciosamente los
 * valores de texto en el CSV exportado — sin avisar de nada. Cortando el
 * rango justo antes de esa fila evitamos la mezcla de tipos por completo.
 */
async function detectarUltimaFilaJugador(): Promise<number> {
  const csv = await fetchCsv("A4:A200", 1);
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: false });
  const filas = parsed.data;
  const idx = filas.findIndex((r) => (r[0] ?? "").trim() === "CONTROL");
  const ultimaFilaJugador = idx === -1 ? 4 + filas.length - 1 : 4 + idx - 1;
  return ultimaFilaJugador;
}

export async function fetchLigaPremios(): Promise<{
  jugadores: JugadorPremios[];
  actualizadoEn: string;
}> {
  const ultimaFila = await detectarUltimaFilaJugador();
  const csv = await fetchCsv(`A3:AW${ultimaFila}`, 1);

  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const jugadores: JugadorPremios[] = [];
  for (const row of parsed.data) {
    const jugador = text(row["Jugador"]);
    if (!jugador) continue;

    jugadores.push({
      jugador,
      eurJornadas: euros(row["€ jornadas"]),
      retoSieteSieteJornada: text(row["Reto 77 (jornada)"]),
      eurRetoSieteSiete: euros(row["€ reto 77"]),
      mejorPuntuacionJornada: text(row["Mejor punt. (jornada)"]),
      eurMejorPuntuacion: euros(row["€ mejor punt."]),
      puestoFinal: text(row["Puesto final"]),
      eurPuestoFinal: euros(row["€ puesto final"]),
      pagado: esSi(row["Pagado"]),
      totalGanado: euros(row["TOTAL GANADO"]),
      neto: euros(
        row["Neto (total − 20 €)"] ?? row["Neto (total - 20 €)"]
      ),
    });
  }

  jugadores.sort((a, b) => b.totalGanado - a.totalGanado);

  return { jugadores, actualizadoEn: new Date().toISOString() };
}
