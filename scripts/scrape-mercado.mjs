#!/usr/bin/env node
/**
 * Scrapea la página pública de mercado de FutbolFantasy.com (LaLiga Fantasy
 * Oficial) y vuelca un índice de jugadores en data/mercado.json.
 *
 * Fuente: https://www.futbolfantasy.com/analytics/laliga-fantasy/mercado
 * No requiere login. La tabla completa (~670 jugadores) viene ya en el HTML
 * como atributos data-* de cada <tr>, ocultos por CSS hasta que el JS del
 * cliente los reordena — por eso una petición HTTP normal basta, no hace
 * falta un navegador headless.
 *
 * Uso: node scripts/scrape-mercado.mjs
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "data", "mercado.json");

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
