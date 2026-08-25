"use client";

import { useEffect, useState } from "react";
import { fetchLigaPremios, type JugadorPremios } from "@/lib/sheet";

function eur(n: number) {
  return n.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function DetalleJugador({ j }: { j: JugadorPremios }) {
  const items = [
    j.eurJornadas > 0 && `${eur(j.eurJornadas)} en jornadas ganadas`,
    j.retoSieteSieteJornada &&
      `Reto 77 puntos en ${j.retoSieteSieteJornada} (${eur(j.eurRetoSieteSiete)})`,
    j.mejorPuntuacionJornada &&
      `Mejor puntuación de la liga en ${j.mejorPuntuacionJornada} (${eur(j.eurMejorPuntuacion)})`,
    j.puestoFinal &&
      `Puesto ${j.puestoFinal} final (${eur(j.eurPuestoFinal)})`,
  ].filter(Boolean) as string[];

  if (items.length === 0) {
    return <span className="text-neutral-500">Sin premios todavía</span>;
  }
  return (
    <ul className="list-disc list-inside space-y-0.5 text-neutral-300">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function TarjetaPremios({ j, puesto }: { j: JugadorPremios; puesto: number }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-neutral-600 text-sm shrink-0">{puesto}</span>
          <span className="font-medium truncate">{j.jugador}</span>
        </div>
        <span
          className={`text-xs shrink-0 ${j.pagado ? "text-emerald-400" : "text-neutral-500"}`}
        >
          {j.pagado ? "Pagado" : "Sin pagar"}
        </span>
      </div>
      <div className="text-sm">
        <DetalleJugador j={j} />
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80">
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Total ganado</div>
          <div className="font-semibold">{eur(j.totalGanado)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase text-neutral-500">Neto</div>
          <div className={`font-semibold ${j.neto < 0 ? "text-red-400" : "text-emerald-400"}`}>
            {eur(j.neto)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PremiosPage() {
  const [jugadores, setJugadores] = useState<JugadorPremios[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLigaPremios()
      .then((data) => setJugadores(data.jugadores))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Error desconocido leyendo el Sheet")
      );
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Premios acumulados</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Datos en vivo del Google Sheet de la liga — se actualiza solo cuando
          alguien rellena una jornada, el reto de los 77 puntos, la mejor
          puntuación o el puesto final.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300 text-sm">
          No se pudo leer el Google Sheet: {error}
          <br />
          Comprueba que el Sheet sigue compartido como &ldquo;cualquiera con
          el enlace&rdquo;.
        </div>
      )}

      {!error && jugadores === null && (
        <p className="text-neutral-500 text-sm">Cargando premios…</p>
      )}

      {!error && jugadores !== null && (
        <div className="space-y-3">
          {jugadores.map((j, i) => (
            <TarjetaPremios key={j.jugador} j={j} puesto={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
