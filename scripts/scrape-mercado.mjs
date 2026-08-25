#!/usr/bin/env node
/**
 * Scrapea la página pública de mercado de FutbolFantasy.com (LaLiga Fantasy
 * Oficial) y vuelca un índice de jugadores en public/mercado.json.
 *
 * Fuente: https://www.futbolfantasy.com/analytics/laliga-fantasy/mercado
 * No requiere login. La tabla completa (~670 jugadores) viene ya en el HTML
 * como atributos data-* de cada <tr>, ocultos por CSS hasta que el JS del
 * cliente los reordena — por eso una petición HTTP normal basta, no hace
 * falta un navegador headless.
 *
 * Por cada jugador se pide además su ficha de detalle (puja máxima
 * rentable, máximo/mínimo de 30 días) y se hornea en el mismo JSON. Esto
 * se hace aquí, en el scraper que corre en Node vía GitHub Actions, y NO
 * en el navegador del usuario: se comprobó que futbolfantasy.com bloquea
 * (probablemente por protección anti-bot / WAF) las peticiones fetch()
 * hechas desde JS de un navegador a estas páginas —devuelven
 * "Failed to fetch"—, mientras que una petición Node/curl normal, sin
 * huella de navegador, funciona sin problema. Como el sitio es estático
 * (GitHub Pages, sin servidor propio), la única forma fiable de tener este
 * dato es precalcularlo aquí y servirlo ya listo.
 *
 * Uso: node scripts/scrape-mercado.mjs
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// En public/ para poder pedirlo por fetch() en tiempo de ejecución desde el
// navegador (el sitio es estático — GitHub Pages no ejecuta código servidor).
const OUT_PATH = join(__dirname, "..", "public", "mercado.json");

const MERCADO_URL = "https://www.futbolfantasy.com/analytics/laliga-fantasy/mercado";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const ROW_RE = /<tr\s+class="([^"]*)"\s*((?:\s*data-[a-z0-9-]+="[^"]*")+)/gs;
const ATTR_RE = /data-([a-z0-9-]+)="([^"]*)"/g;

function parseRows(html) {
  const rows = [];
  for (const m of html.matchAll(ROW_RE)) {
    const attrsBlob = m[2];
    const attrs = {};
    for (const am of attrsBlob.matchAll(ATTR_RE)) {
      attrs[am[1]] = am[2];
    }
    if (attrs.id) rows.push(attrs);
  }
  return rows;
}

function parseTeams(html) {
  const selMatch = html.match(
    /<select[^>]*id="equipoSelect"[^>]*>([\s\S]*?)<\/select>/
  );
  if (!selMatch) return {};
  const teams = {};
  const optRe = /<option value="(\d+)" data-identificador="([^"]*)">([^<]*)<\/option>/g;
  for (const m of selMatch[1].matchAll(optRe)) {
    teams[m[1]] = { slug: m[2], nombre: m[3].trim() };
  }
  return teams;
}

function num(v) {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function normalize(str) {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchDetalle(id) {
  const url = `https://www.futbolfantasy.com/analytics/laliga-fantasy/mercado/detalle/${id}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" },
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const err = new Error("HTTP 429");
    err.retryAfterMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : null;
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // Cuando no hay puja rentable que recomendar, la web igualmente emite
  // "parsePujaIdeal(0)" en el HTML — el 0 es un valor de relleno que el JS
  // del cliente (que no vemos, se resuelve en su bundle) convierte en el
  // texto "Sin rentabilidad". Ojo: ese texto "Sin rentabilidad" TAMBIÉN
  // aparece siempre en el párrafo explicativo genérico de cada página
  // (describe la función, no el estado de este jugador en concreto), así
  // que buscarlo literalmente daba falsos positivos hasta en jugadores con
  // una puja real. El único indicador fiable que tenemos es que el propio
  // parsePujaIdeal reciba un 0 — si trae un número mayor, es una puja de
  // verdad.
  const pujaMatch = html.match(/parsePujaIdeal\((\d+)\s*\)/);
  const pujaBruta = pujaMatch ? Number(pujaMatch[1]) : null;
  const sinRentabilidad = pujaBruta === 0;
  const pujaMaximaRentable = pujaBruta && pujaBruta > 0 ? pujaBruta : null;

  let valorMax30d = null;
  let valorMin30d = null;
  const histRe = /player_chartjs_30\.push\(\{date:\s*"([^"]+)",\s*value:\s*(\d+)\}\)/g;
  for (const m of html.matchAll(histRe)) {
    const v = Number(m[2]);
    if (valorMax30d === null || v > valorMax30d) valorMax30d = v;
    if (valorMin30d === null || v < valorMin30d) valorMin30d = v;
  }

  return { pujaMaximaRentable, sinRentabilidad, valorMax30d, valorMin30d };
}

// El sitio rate-limita agresivamente (medido: con 12 en paralelo, el 95%
// de las peticiones acababan en HTTP 429). Vamos secuenciales, con una
// pausa entre peticiones y reintentos con espera creciente si aun así nos
// tropezamos con un 429 — 671 peticiones así tardan varios minutos, pero es
// un cron nocturno: no hay prisa, y es lo respetuoso con su servidor.
const PAUSA_ENTRE_PETICIONES_MS = 400;
const REINTENTOS = 4;

async function fetchDetalleConReintentos(id) {
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    try {
      return await fetchDetalle(id);
    } catch (err) {
      if (intento === REINTENTOS) throw err;
      const espera = err.retryAfterMs ?? 1000 * 2 ** intento; // 1s, 2s, 4s, 8s
      await sleep(espera);
    }
  }
}

async function fetchTodosLosDetalles(ids, onProgress) {
  const resultados = new Map();
  for (let idx = 0; idx < ids.length; idx++) {
    const id = ids[idx];
    try {
      resultados.set(id, await fetchDetalleConReintentos(id));
    } catch (err) {
      console.warn(`  aviso: detalle de ${id} falló (${err.message}), se deja sin esos datos`);
      resultados.set(id, {
        pujaMaximaRentable: null,
        sinRentabilidad: false,
        valorMax30d: null,
        valorMin30d: null,
      });
    }
    onProgress?.(idx + 1, ids.length);
    await sleep(PAUSA_ENTRE_PETICIONES_MS);
  }
  return resultados;
}

async function main() {
  console.log("Descargando", MERCADO_URL);
  const res = await fetch(MERCADO_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al descargar la página de mercado`);
  }
  const html = await res.text();

  const teams = parseTeams(html);
  const rawRows = parseRows(html);
  console.log(`Filas de jugador encontradas: ${rawRows.length}`);
  if (rawRows.length < 300) {
    throw new Error(
      `Solo se encontraron ${rawRows.length} jugadores — la web probablemente cambió su HTML. Revisa el scraper.`
    );
  }

  const players = rawRows.map((r) => {
    const team = teams[r.equipo] || null;
    return {
      id: r.id,
      nombre: r.nombre,
      nombreNormalizado: normalize(r.nombre),
      posicion: r.posicion || null,
      equipoId: r.equipo || null,
      equipo: team ? team.nombre : null,
      valor: num(r.valor),
      tendenciaDias: num(r.tendencia),
      aceleracion: num(r.aceleracion),
      diferencia1d: num(r["diferencia1"]),
      diferenciaPct1d: num(r["diferencia-pct1"]),
      diferencia7d: num(r["diferencia7"]),
      diferenciaPct7d: num(r["diferencia-pct7"]),
      diferencia30d: num(r["diferencia30"]),
      diferenciaPct30d: num(r["diferencia-pct30"]),
      valorHace1d: num(r["valor1"]),
      valorHace7d: num(r["valor7"]),
      valorHace30d: num(r["valor30"]),
    };
  });

  console.log(`Pidiendo la ficha de detalle de ${players.length} jugadores (puja máxima rentable, máx/mín 30 días)…`);
  let hecho = 0;
  const detalles = await fetchTodosLosDetalles(
    players.map((p) => p.id),
    (n, total) => {
      hecho = n;
      if (n % 100 === 0 || n === total) console.log(`  ${n}/${total}`);
    }
  );
  for (const p of players) {
    const d = detalles.get(p.id);
    p.pujaMaximaRentable = d?.pujaMaximaRentable ?? null;
    p.sinRentabilidad = d?.sinRentabilidad ?? false;
    p.valorMax30d = d?.valorMax30d ?? null;
    p.valorMin30d = d?.valorMin30d ?? null;
  }
  console.log(`Detalle completado para ${hecho} jugadores.`);

  const payload = {
    fuente: MERCADO_URL,
    actualizadoEn: new Date().toISOString(),
    totalJugadores: players.length,
    jugadores: players,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`Guardado ${players.length} jugadores en ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("Fallo el scraper:", err);
  process.exit(1);
});
