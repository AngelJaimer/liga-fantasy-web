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

// Qué jugadores del índice comparten cada apellido (el último token del
// nombre). Se usa para decidir si con solo el apellido basta: la app suele
// mostrar solo el apellido en las tarjetas ("Catena", no "Alejandro
// Catena"), así que exigir siempre el nombre completo perdería la mayoría
// de coincidencias reales. Si el apellido es único en toda la liga, no
// hace falta el nombre de pila para estar seguros de quién es; si lo
// comparten varios, todavía se puede desambiguar por la inicial (ver
// `mejorCoincidenciaPorTokens` — la app a veces muestra "A. Herrero").
function agruparPorApellido(jugadores: JugadorMercado[]): Map<string, JugadorMercado[]> {
  const grupos = new Map<string, JugadorMercado[]>();
  for (const j of jugadores) {
    const tokens = tokensDe(j.nombreNormalizado);
    if (tokens.length === 0) continue;
    const apellido = tokens[tokens.length - 1];
    const grupo = grupos.get(apellido);
    if (grupo) grupo.push(j);
    else grupos.set(apellido, [j]);
  }
  return grupos;
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
 * Hace falta encontrar TODOS los tokens del nombre, salvo dos atajos para
 * cuando la app solo muestra el apellido (pasa a menudo):
 *  - si ese apellido es único en todo el índice, basta con él.
 *  - si lo comparten varios jugadores pero la línea trae una inicial
 *    ("A. Herrero") que coincide con el nombre de pila de solo uno de
 *    ellos, también queda desambiguado.
 * Es preferible no encontrar a nadie que encontrar a quien no es — por
 * eso, ante empate, gana el nombre con más tokens (más específico, menos
 * probable que sea casualidad).
 */
function mejorCoincidenciaPorTokens(
  linea: string,
  jugadores: JugadorMercado[],
  idsYaUsados: Set<string>,
  gruposApellido: Map<string, JugadorMercado[]>
): { jugador: JugadorMercado; confianza: number } | null {
  const lineaNorm = normalizeName(linea);
  if (lineaNorm.length < TOKEN_MIN_LEN) return null;
  const palabrasLinea = lineaNorm
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= TOKEN_MIN_LEN && !PALABRAS_INTERFAZ.has(p));
  if (palabrasLinea.length === 0) return null;

  // Iniciales tipo "A." que aparezcan en la línea (sin normalizar: hace
  // falta la mayúscula), normalizadas para comparar con el nombre de pila.
  const inicialesLinea = new Set(
    [...linea.matchAll(/\b([A-ZÁÉÍÓÚÑ])\.\s*/g)].map((m) => normalizeName(m[1]))
  );

  let mejor: { jugador: JugadorMercado; tokens: number; confianza: number } | null = null;
  for (const j of jugadores) {
    if (idsYaUsados.has(j.id)) continue;
    const tokens = tokensDe(j.nombreNormalizado);
    if (tokens.length === 0) continue;

    const todos = tokens.every((t) => contieneTokenAproximado(palabrasLinea, t));
    const apellido = tokens[tokens.length - 1];
    const apellidoEnLinea = tokens.length > 1 && contieneTokenAproximado(palabrasLinea, apellido);

    let confianza: number | null = todos ? 1 : null;
    if (!todos && apellidoEnLinea) {
      const grupo = gruposApellido.get(apellido) ?? [];
      if (grupo.length === 1) {
        confianza = 0.85; // apellido único en todo el índice
      } else if (grupo.length > 1 && inicialesLinea.has(tokens[0][0])) {
        // Apellido compartido, pero la inicial de pila que trae la línea
        // solo cuadra con uno de ellos.
        const otrosConEsaInicial = grupo.filter((g) => {
          const t = tokensDe(g.nombreNormalizado);
          return t.length > 0 && t[0][0] === tokens[0][0];
        });
        if (otrosConEsaInicial.length === 1) confianza = 0.8;
      }
    }
    if (confianza === null) continue;

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
  const gruposApellido = agruparPorApellido(jugadores);
  const idsYaUsados = new Set<string>();
  const coincidencias: CoincidenciaOcr[] = [];
  const sinCoincidencia: string[] = [];

  const lineas = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);

  for (const linea of lineas) {
    const match =
      mejorCoincidenciaPorTokens(linea, jugadores, idsYaUsados, gruposApellido) ??
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
