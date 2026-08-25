"use client";

import { useState } from "react";
import { loadMercadoIndex } from "@/lib/mercadoIndex";
import { matchOcrTextoContraIndice, type CoincidenciaOcr } from "@/lib/matchOcr";
import SubidaCapturas from "@/components/SubidaCapturas";

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

function recomendacion(c: CoincidenciaOcr): { texto: string; clase: string } | null {
  const crecimiento = c.jugador.diferenciaPct7d;
  if (crecimiento === null) return null;
  if (crecimiento >= 8) return { texto: "🔥 Alto potencial", clase: "text-orange-400" };
  if (crecimiento > 0) return { texto: "📈 Subiendo", clase: "text-emerald-400" };
  if (crecimiento < -3) return { texto: "📉 Bajando", clase: "text-red-400" };
  return null;
}

function TarjetaCandidato({ c, puesto }: { c: CoincidenciaOcr; puesto: number }) {
  const rec = recomendacion(c);
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-neutral-600 text-sm shrink-0">{puesto}</span>
          <div className="min-w-0">
            <div className="font-medium capitalize truncate">{c.jugador.nombre}</div>
            <div className="text-xs text-neutral-500">
              {c.jugador.equipo ?? "—"} · {c.jugador.posicion ?? "—"}
            </div>
          </div>
        </div>
        {rec && (
          <span className={`text-xs font-medium whitespace-nowrap shrink-0 ${rec.clase}`}>
            {rec.texto}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Valor actual</div>
          <div>{eur(c.jugador.valor)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Crecimiento 7d</div>
          <div className={(c.jugador.diferenciaPct7d ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
            {pct(c.jugador.diferenciaPct7d)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Puja rentable</div>
          <div>{c.jugador.sinRentabilidad ? "—" : eur(c.jugador.pujaMaximaRentable)}</div>
        </div>
      </div>
    </div>
  );
}

export default function RobarPage() {
  const [candidatos, setCandidatos] = useState<CoincidenciaOcr[] | null>(null);
  const [sinCoincidencia, setSinCoincidencia] = useState<string[]>([]);

  const analizar = async (textoCompleto: string) => {
    const { jugadores } = await loadMercadoIndex();
    const { coincidencias, sinCoincidencia } = matchOcrTextoContraIndice(
      textoCompleto,
      jugadores
    );
    // Orden por potencial de crecimiento (subida % últimos 7 días); sin
    // dato de tendencia se van al final.
    const ordenados = [...coincidencias].sort(
      (a, b) => (b.jugador.diferenciaPct7d ?? -999) - (a.jugador.diferenciaPct7d ?? -999)
    );
    setCandidatos(ordenados);
    setSinCoincidencia(sinCoincidencia);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">¿A quién robar?</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Sube capturas de la plantilla de un rival. Reconocemos a sus
          jugadores y los ordenamos por potencial de crecimiento — subida de
          valor en los últimos 7 días — para que sepas a quién merece la
          pena poner el ojo.
        </p>
        <p className="text-neutral-500 text-xs mt-2">
          Los valores son siempre del índice de referencia (no de lo que
          diga la captura) — comprueba en la app si la cláusula está
          bloqueada antes de pujar.
        </p>
      </div>

      <SubidaCapturas onResultado={analizar} textoBoton="Analizar plantilla" />

      {candidatos && (
        <div className="space-y-4">
          <div className="space-y-3">
            {candidatos.map((c, i) => (
              <TarjetaCandidato key={c.jugador.id} c={c} puesto={i + 1} />
            ))}
            {candidatos.length === 0 && (
              <p className="text-sm text-neutral-500">
                No se reconoció a ningún jugador en el texto leído.
              </p>
            )}
          </div>

          {sinCoincidencia.length > 0 && (
            <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-amber-200 text-sm">
              <p className="font-medium mb-1">
                Líneas que no se pudieron emparejar con ningún jugador:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-300/80">
                {sinCoincidencia.map((l, i) => (
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
