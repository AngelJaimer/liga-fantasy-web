import Fuse from "fuse.js";
import { normalizeName, type JugadorMercado } from "./mercadoIndex";

export type LineaOcr = {
  lineaOriginal: string;
  precioDetectado: number | null;
};

export type CoincidenciaOcr = {
  linea: string;
  precioDetectado: number | null;
  jugador: JugadorMercado;
  confianza: number; // 0-1, 1 = coincidencia perfecta
};

export type ResultadoMatch = {
  coincidencias: CoincidenciaOcr[];
  sinCoincidencia: string[];
};

// Precio tipo "61.810.018", "61,810,018", "61.810.018 €" o abreviado "61,8M" / "61.8M€"
const PRECIO_RE =
  /(\d{1,3}(?:[.,]\d{3}){2,}|\d+(?:[.,]\d+)?\s*[Mm](?:€|\b))/;

function parsePrecio(match: string): number | null {
  const m = match.trim();
  const abbr = m.match(/^(\d+(?:[.,]\d+)?)\s*[Mm]/);
  if (abbr) {
    return Math.round(parseFloat(abbr[1].replace(",", ".")) * 1_000_000);
  }
  const digits = m.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isNaN(n) ? null : n;
}

function extractLineas(rawText: string): LineaOcr[] {
  return rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2)
    .map((linea) => {
      const m = linea.match(PRECIO_RE);
      return {
        lineaOriginal: linea,
        precioDetectado: m ? parsePrecio(m[0]) : null,
      };
    });
}

/**
 * Empareja el texto crudo salido del OCR (una captura del mercado, o de tu
 * plantilla) contra el índice de ~670 jugadores de LaLiga. El texto de un
 * OCR es ruidoso (acentos mal leídos, palabras pegadas, precios partidos en
 * varias líneas), así que usamos fuzzy matching por nombre y nos quedamos
 * con la mejor coincidencia por encima de un umbral. Si el precio no está
 * en la misma línea que el nombre, miramos también la línea siguiente
 * (patrón típico en capturas: nombre arriba, precio debajo).
 */
export function matchOcrTextoContraIndice(
  rawText: string,
  jugadores: JugadorMercado[]
): ResultadoMatch {
  const fuse = new Fuse(jugadores, {
    keys: ["nombreNormalizado"],
    threshold: 0.4, // más bajo = más estricto
    ignoreLocation: true,
    includeScore: true, // sin esto, mejor.score es undefined y todo se rechaza
  });

  const lineas = extractLineas(rawText);
  const coincidencias: CoincidenciaOcr[] = [];
  const sinCoincidencia: string[] = [];
  const idsYaUsados = new Set<string>();

  lineas.forEach((linea, i) => {
    // quita el precio de la línea para no confundir al matcher de nombres
    const soloTexto = linea.lineaOriginal.replace(PRECIO_RE, "").trim();
    if (soloTexto.length < 3) return;

    const query = normalizeName(soloTexto);
    const resultados = fuse.search(query, { limit: 1 });
    if (resultados.length === 0) {
      sinCoincidencia.push(linea.lineaOriginal);
      return;
    }

    const mejor = resultados[0];
    const jugador = mejor.item;
    const score = mejor.score ?? 1;
    if (score > 0.4 || idsYaUsados.has(jugador.id)) {
      sinCoincidencia.push(linea.lineaOriginal);
      return;
    }

    let precio = linea.precioDetectado;
    if (precio === null) {
      const siguiente = lineas[i + 1];
      if (siguiente?.precioDetectado !== undefined && siguiente?.precioDetectado !== null) {
        precio = siguiente.precioDetectado;
      }
    }

    idsYaUsados.add(jugador.id);
    coincidencias.push({
      linea: linea.lineaOriginal,
      precioDetectado: precio,
      jugador,
      confianza: Math.max(0, 1 - score),
    });
  });

  return { coincidencias, sinCoincidencia };
}
