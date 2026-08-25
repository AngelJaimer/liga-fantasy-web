"use client";

import { useState } from "react";
import { loadMercadoIndex } from "@/lib/mercadoIndex";
import { matchOcrTextoContraIndice, type CoincidenciaOcr } from "@/lib/matchOcr";
import SubidaCapturas from "@/components/SubidaCapturas";

type Resultado = { coincidencias: CoincidenciaOcr[]; sinCoincidencia: string[] } | null;

function eur(n: number | null) {
  if (n === null) return "—";
  return n.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function pct(n: number | null) {
  if (n === null) return "—";
  const signo = n > 0 ? "+" : "";
  return `${signo}${n.toFixed(1)}%`;
}

function TarjetaJugador({ c }: { c: CoincidenciaOcr }) {
  const subiendo = (c.jugador.diferenciaPct1d ?? 0) >= 0;
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium capitalize">{c.jugador.nombre}</div>
          <div className="text-xs text-neutral-500">
            {c.jugador.equipo ?? "—"} · {c.jugador.posicion ?? "—"}
          </div>
        </div>
        {c.jugador.sinRentabilidad ? (
          <span className="text-xs text-red-400 whitespace-nowrap">Sin rentabilidad</span>
        ) : (
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase text-neutral-500">Puja rentable</div>
            <div className="text-sm font-semibold">{eur(c.jugador.pujaMaximaRentable)}</div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Valor actual</div>
          <div>{eur(c.jugador.valor)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Últ. mercado</div>
          <div className={subiendo ? "text-emerald-400" : "text-red-400"}>
            {pct(c.jugador.diferenciaPct1d)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MercadoPage() {
  const [resultado, setResultado] = useState<Resultado>(null);

  const analizar = async (textoCompleto: string) => {
    const { jugadores } = await loadMercadoIndex();
    setResultado(matchOcrTextoContraIndice(textoCompleto, jugadores));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mercado</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Sube una o varias capturas del mercado. Leemos los nombres con
          OCR, los buscamos en el índice (actualizado a diario) y te
          decimos su subida en el último mercado y su puja máxima rentable.
        </p>
      </div>

      <SubidaCapturas onResultado={analizar} />

      {resultado && (
        <div className="space-y-4">
          <div className="space-y-3">
            {resultado.coincidencias.map((c) => (
              <TarjetaJugador key={c.jugador.id} c={c} />
            ))}
            {resultado.coincidencias.length === 0 && (
              <p className="text-sm text-neutral-500">
                No se reconoció a ningún jugador en el texto leído.
              </p>
            )}
          </div>

          {resultado.sinCoincidencia.length > 0 && (
            <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-amber-200 text-sm">
              <p className="font-medium mb-1">
                Líneas que no se pudieron emparejar con ningún jugador:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-300/80">
                {resultado.sinCoincidencia.map((l, i) => (
                  <li key={i} className="break-words">{l}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
