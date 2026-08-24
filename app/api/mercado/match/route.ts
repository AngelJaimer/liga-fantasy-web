import { NextRequest, NextResponse } from "next/server";
import { loadMercadoIndex } from "@/lib/mercadoIndex";
import { matchOcrTextoContraIndice } from "@/lib/matchOcr";
import { fetchPlayerDetalle } from "@/lib/mercadoDetalle";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const texto: string | undefined = body?.texto;
  if (!texto || typeof texto !== "string") {
    return NextResponse.json(
      { error: "Falta 'texto' (el texto crudo salido del OCR) en el body." },
      { status: 400 }
    );
  }

  const { jugadores, actualizadoEn } = await loadMercadoIndex();
  const { coincidencias, sinCoincidencia } = matchOcrTextoContraIndice(
    texto,
    jugadores
  );

  const enriquecidas = await Promise.all(
    coincidencias.map(async (c) => {
      let detalle = null;
      try {
        detalle = await fetchPlayerDetalle(c.jugador.id);
      } catch {
        // si falla el detalle de un jugador concreto, seguimos con el resto
        detalle = null;
      }
      return {
        linea: c.linea,
        precioDetectado: c.precioDetectado,
        confianza: c.confianza,
        jugador: c.jugador,
        pujaMaximaRentable: detalle?.pujaMaximaRentable ?? null,
        sinRentabilidad: detalle?.sinRentabilidad ?? false,
        valorMax30d: detalle?.valorMax30d ?? null,
        valorMin30d: detalle?.valorMin30d ?? null,
      };
    })
  );

  return NextResponse.json({
    indiceActualizadoEn: actualizadoEn,
    coincidencias: enriquecidas,
    sinCoincidencia,
  });
}
