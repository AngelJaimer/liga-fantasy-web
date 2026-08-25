"use client";

import { useCallback, useEffect, useState } from "react";
import { loadMercadoIndex, type JugadorMercado } from "@/lib/mercadoIndex";
import { matchOcrTextoContraIndice } from "@/lib/matchOcr";
import { marcarVistosEnMercado, leerMercadoDeHoy } from "@/lib/mercadoDia";
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

function TarjetaJugador({ jugador }: { jugador: JugadorMercado }) {
  const subiendo = (jugador.diferenciaPct1d ?? 0) >= 0;
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium capitalize">{jugador.nombre}</div>
          <div className="text-xs text-neutral-500">
            {jugador.equipo ?? "—"} · {jugador.posicion ?? "—"}
          </div>
        </div>
        {jugador.sinRentabilidad ? (
          <span className="text-xs text-red-400 whitespace-nowrap">Sin rentabilidad</span>
        ) : (
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase text-neutral-500">Puja rentable</div>
            <div className="text-sm font-semibold">{eur(jugador.pujaMaximaRentable)}</div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Valor actual</div>
          <div>{eur(jugador.valor)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Últ. mercado</div>
          <div className={subiendo ? "text-emerald-400" : "text-red-400"}>
            {pct(jugador.diferenciaPct1d)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MercadoPage() {
  const [mercadoHoy, setMercadoHoy] = useState<JugadorMercado[] | null>(null);
  const [cargandoHoy, setCargandoHoy] = useState(true);
  const [sinCoincidencia, setSinCoincidencia] = useState<string[] | null>(null);

  const cargarMercadoDeHoy = useCallback(async () => {
    setCargandoHoy(true);
    try {
      const [{ jugadores }, idsVistos] = await Promise.all([
        loadMercadoIndex(),
        leerMercadoDeHoy(),
      ]);
      const porId = new Map(jugadores.map((j) => [j.id, j]));
      const encontrados = idsVistos
        .map((id) => porId.get(id))
        .filter((j): j is JugadorMercado => !!j)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      setMercadoHoy(encontrados);
    } finally {
      setCargandoHoy(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial de datos externos (Firestore) al montar — el propio
    // cargarMercadoDeHoy gestiona sus setState de forma segura.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarMercadoDeHoy();
  }, [cargarMercadoDeHoy]);

  const analizar = async (textoCompleto: string) => {
    const { jugadores } = await loadMercadoIndex();
    const { coincidencias, sinCoincidencia } = matchOcrTextoContraIndice(
      textoCompleto,
      jugadores
    );
    setSinCoincidencia(sinCoincidencia);

    if (coincidencias.length > 0) {
      await marcarVistosEnMercado(coincidencias.map((c) => c.jugador.id));
    }
    await cargarMercadoDeHoy();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mercado de hoy</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Sube capturas del mercado y se suman aquí para todo el grupo —
          nunca se guarda la captura en sí, solo qué jugadores había. Se
          reinicia solo con cada mercado nuevo (~14:06 hora de Nueva York).
        </p>
      </div>

      <SubidaCapturas onResultado={analizar} />

      {sinCoincidencia && sinCoincidencia.length > 0 && (
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

      <div className="space-y-3">
        {cargandoHoy && (
          <p className="text-sm text-neutral-500">Cargando el mercado de hoy…</p>
        )}
        {!cargandoHoy && mercadoHoy?.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nadie ha subido capturas del mercado todavía en este ciclo — sé el primero.
          </p>
        )}
        {mercadoHoy?.map((j) => (
          <TarjetaJugador key={j.id} jugador={j} />
        ))}
      </div>
    </div>
  );
}
