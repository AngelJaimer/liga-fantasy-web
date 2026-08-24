const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export type DetallePuntoHistorial = { fecha: string; valor: number };

export type DetalleJugador = {
  id: string;
  pujaMaximaRentable: number | null;
  sinRentabilidad: boolean;
  valorMax30d: number | null;
  valorMin30d: number | null;
  historial30d: DetallePuntoHistorial[];
};

// Pequeña caché en memoria del proceso — el detalle no cambia más de una
// vez al día (el mercado se recalcula a las 00:17), así que evitamos
// pegarle a futbolfantasy.com por cada jugador en cada subida de captura.
const cache = new Map<string, { data: DetalleJugador; expiresAt: number }>();
const TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

export async function fetchPlayerDetalle(id: string): Promise<DetalleJugador> {
  const hit = cache.get(id);
  if (hit && hit.expiresAt > Date.now()) return hit.data;

  const url = `https://www.futbolfantasy.com/analytics/laliga-fantasy/mercado/detalle/${id}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://www.futbolfantasy.com/analytics/laliga-fantasy/mercado",
    },
  });
  if (!res.ok) {
    throw new Error(`No se pudo leer el detalle del jugador ${id} (HTTP ${res.status})`);
  }
  const html = await res.text();

  const pujaMatch = html.match(/parsePujaIdeal\((\d+)\s*\)/);
  const pujaMaximaRentable = pujaMatch ? Number(pujaMatch[1]) : null;
  const sinRentabilidad = /Sin rentabilidad/.test(html) && pujaMaximaRentable === null;

  const historial30d: DetallePuntoHistorial[] = [];
  const histRe = /player_chartjs_30\.push\(\{date:\s*"([^"]+)",\s*value:\s*(\d+)\}\)/g;
  for (const m of html.matchAll(histRe)) {
    historial30d.push({ fecha: m[1], valor: Number(m[2]) });
  }

  let valorMax30d: number | null = null;
  let valorMin30d: number | null = null;
  for (const p of historial30d) {
    if (valorMax30d === null || p.valor > valorMax30d) valorMax30d = p.valor;
    if (valorMin30d === null || p.valor < valorMin30d) valorMin30d = p.valor;
  }

  const data: DetalleJugador = {
    id,
    pujaMaximaRentable,
    sinRentabilidad,
    valorMax30d,
    valorMin30d,
    historial30d,
  };

  cache.set(id, { data, expiresAt: Date.now() + TTL_MS });
  return data;
}
