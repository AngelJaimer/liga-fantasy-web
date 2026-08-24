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
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-neutral-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Jugador</th>
                <th className="px-4 py-3 font-medium">Detalle de premios</th>
                <th className="px-4 py-3 font-medium text-right">Pagado</th>
                <th className="px-4 py-3 font-medium text-right">
                  Total ganado
                </th>
                <th className="px-4 py-3 font-medium text-right">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {jugadores.map((j, i) => (
                <tr key={j.jugador} className="hover:bg-neutral-900/40">
                  <td className="px-4 py-3 text-neutral-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{j.jugador}</td>
                  <td className="px-4 py-3">
                    <DetalleJugador j={j} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {j.pagado ? (
                      <span className="text-emerald-400">Sí</span>
                    ) : (
                      <span className="text-neutral-500">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {eur(j.totalGanado)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      j.neto < 0 ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {eur(j.neto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
