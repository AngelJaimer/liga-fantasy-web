import Fuse from "fuse.js";
import { normalizeName, type JugadorMercado } from "./mercadoIndex";

export type CoincidenciaOcr = {
  linea: string;
  jugador: JugadorMercado;
  confianza: number; // 0-1, 1 = coincidencia perfecta
};

export type ResultadoMatch = {
  coincidencias: CoincidenciaOcr[];
  sinCoincidencia: string[];
};

const TOKEN_MIN_LEN = 4;

// Palabras de la interfaz que salen constantemente en las capturas. Hay que
// descartarlas explícitamente como candidatas a "palabra de la línea": con
// tolerancia de una letra, "Valor"/"Precio" quedan a un carácter de
// apellidos reales como "Valou" o "Recio" — sin esta lista, esos apellidos
// se emparejaban por accidente con el propio rótulo de la interfaz.
const PALABRAS_INTERFAZ = new Set([
  "alineable",
  "lesionado",
  "sancionado",
  "acciones",
  "fichar",
  "media",
  "pfsy",
  "prsy",
  "valor",
  "precio",
  "laliga",
  "historico",
  "operaciones",
  "clasificacion",
  "jornada",
  "mercado",
  "puntos",
]);

function tokensDe(nombreNormalizado: string): string[] {
  return nombreNormalizado.split(" ").filter((t) => t.length >= TOKEN_MIN_LEN);
}

function crearFuse(jugadores: JugadorMercado[]) {
  return new Fuse(jugadores, {
    keys: ["nombreNormalizado"],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true, // sin esto, mejor.score es undefined y todo se rechaza
  });
}

// Cuántos jugadores del índice comparten cada apellido (el último token del
// nombre). Se usa para decidir si con solo el apellido basta: la app suele
// mostrar solo el apellido en las tarjetas ("Catena", no "Alejandro
// Catena"), así que exigir siempre el nombre completo perdería la mayoría
// de coincidencias reales. Si el apellido es único en toda la liga, no
// hace falta el nombre de pila para estar seguros de quién es.
function contarApellidos(jugadores: JugadorMercado[]): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const j of jugadores) {
    const tokens = tokensDe(j.nombreNormalizado);
    if (tokens.length === 0) continue;
    const apellido = tokens[tokens.length - 1];
    conteo.set(apellido, (conteo.get(apellido) ?? 0) + 1);
  }
  return conteo;
}

// Distancia de edición acotada a 1 — solo nos interesa saber si dos
// palabras son "casi iguales" (una letra de más, de menos o distinta),
// que es el tipo de error más típico del OCR sobre texto pequeño. No hace
// falta una implementación general de Levenshtein para esto.
function casiIgual(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let difs = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) if (++difs > 1) return false;
    return true;
  }
  // una es un carácter más larga que la otra: comprobar que borrando esa
  // posición coinciden (inserción/omisión de una letra)
  const [larga, corta] = a.length > b.length ? [a, b] : [b, a];
  for (let i = 0; i < larga.length; i++) {
    if (larga.slice(0, i) + larga.slice(i + 1) === corta) return true;
  }
  return false;
}

function contieneTokenAproximado(palabrasLinea: string[], token: string): boolean {
  return palabrasLinea.some((p) => (p.length >= 5 ? casiIgual(p, token) : p === token));
}

/**
 * Busca el jugador cuyos tokens de nombre aparecen (exactos o con hasta un
 * carácter de diferencia — típico error de OCR) dentro de una línea de
 * texto. A diferencia de un fuzzy match por distancia de edición sobre la
 * línea entera, esto aguanta bien que el OCR mezcle el nombre con iconos,
 * el badge de posición o los puntos PFSY en la misma línea — muy habitual
 * en capturas reales de la app, donde nombre y puntos comparten fila
 * visual.
 *
 * Hace falta encontrar TODOS los tokens del nombre, salvo que el apellido
 * por sí solo sea único en el índice (ver `contarApellidos`), en cuyo caso
 * ese basta. Es preferible no encontrar a nadie que encontrar a quien no
 * es — por eso, ante empate, gana el nombre con más tokens (más
 * específico, menos probable que sea casualidad).
 */
function mejorCoincidenciaPorTokens(
  linea: string,
  jugadores: JugadorMercado[],
  idsYaUsados: Set<string>,
  apellidosUnicos: Map<string, number>
): { jugador: JugadorMercado; confianza: number } | null {
  const lineaNorm = normalizeName(linea);
  if (lineaNorm.length < TOKEN_MIN_LEN) return null;
  const palabrasLinea = lineaNorm
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= TOKEN_MIN_LEN && !PALABRAS_INTERFAZ.has(p));
  if (palabrasLinea.length === 0) return null;

  let mejor: { jugador: JugadorMercado; tokens: number; confianza: number } | null = null;
  for (const j of jugadores) {
    if (idsYaUsados.has(j.id)) continue;
    const tokens = tokensDe(j.nombreNormalizado);
    if (tokens.length === 0) continue;

    const todos = tokens.every((t) => contieneTokenAproximado(palabrasLinea, t));
    const apellido = tokens[tokens.length - 1];
    // Aquí SIN tolerancia difusa a propósito: es la vía "débil" (un solo
    // token en vez del nombre completo), así que se exige coincidencia
    // exacta para compensar.
    const soloApellidoVale =
      !todos &&
      tokens.length > 1 &&
      apellidosUnicos.get(apellido) === 1 &&
      palabrasLinea.includes(apellido);

    if (!todos && !soloApellidoVale) continue;

    const confianza = todos ? 1 : 0.85;
    if (!mejor || tokens.length > mejor.tokens || (tokens.length === mejor.tokens && confianza > mejor.confianza)) {
      mejor = { jugador: j, tokens: tokens.length, confianza };
    }
  }
  return mejor ? { jugador: mejor.jugador, confianza: mejor.confianza } : null;
}

function mejorCoincidenciaFuse(
  fuse: Fuse<JugadorMercado>,
  texto: string,
  idsYaUsados: Set<string>
): { jugador: JugadorMercado; confianza: number } | null {
  if (texto.length < 3) return null;
  const resultados = fuse.search(normalizeName(texto), { limit: 1 });
  if (resultados.length === 0) return null;
  const mejor = resultados[0];
  const score = mejor.score ?? 1;
  if (score > 0.35 || idsYaUsados.has(mejor.item.id)) return null;
  return { jugador: mejor.item, confianza: Math.max(0, 1 - score) };
}

/**
 * Empareja el texto crudo salido del OCR de una captura (mercado, plantilla
 * propia o de un rival — cualquier pantalla con nombres de jugador) contra
 * el índice de ~670 jugadores de LaLiga. Solo hace falta reconocer QUIÉN
 * es cada jugador: el resto de datos (valor, tendencia, puja máxima
 * rentable) se sacan siempre del índice propio, no de lo que diga la
 * captura — es más fiable y evita depender de leer bien números pequeños
 * mezclados con iconos.
 */
export function matchOcrTextoContraIndice(
  rawText: string,
  jugadores: JugadorMercado[]
): ResultadoMatch {
  const fuse = crearFuse(jugadores);
  const apellidosUnicos = contarApellidos(jugadores);
  const idsYaUsados = new Set<string>();
  const coincidencias: CoincidenciaOcr[] = [];
  const sinCoincidencia: string[] = [];

  const lineas = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);

  for (const linea of lineas) {
    const match =
      mejorCoincidenciaPorTokens(linea, jugadores, idsYaUsados, apellidosUnicos) ??
      mejorCoincidenciaFuse(fuse, linea, idsYaUsados);
    if (!match) {
      sinCoincidencia.push(linea);
      continue;
    }
    idsYaUsados.add(match.jugador.id);
    coincidencias.push({ linea, jugador: match.jugador, confianza: match.confianza });
  }

  return { coincidencias, sinCoincidencia };
}
