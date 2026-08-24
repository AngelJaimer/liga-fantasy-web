"use client";

import { useState, useCallback } from "react";
import type { JugadorMercado } from "@/lib/mercadoIndex";

type Coincidencia = {
  linea: string;
  precioDetectado: number | null;
  confianza: number;
  jugador: JugadorMercado;
  pujaMaximaRentable: number | null;
  sinRentabilidad: boolean;
  valorMax30d: number | null;
  valorMin30d: number | null;
};

type EstadoOcr =
  | { fase: "idle" }
  | { fase: "leyendo"; progreso: number }
  | { fase: "buscando" }
  | { fase: "listo"; coincidencias: Coincidencia[]; sinCoincidencia: string[] }
  | { fase: "error"; mensaje: string };

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

export default function MercadoPage() {
  const [estado, setEstado] = useState<EstadoOcr>({ fase: "idle" });
  const [archivos, setArchivos] = useState<File[]>([]);

  const procesar = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setEstado({ fase: "leyendo", progreso: 0 });

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("spa", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setEstado({ fase: "leyendo", progreso: m.progress });
          }
        },
      });

      let textoCompleto = "";
      for (const file of files) {
        const {
          data: { text },
        } = await worker.recognize(file);
        textoCompleto += text + "\n";
      }
      await worker.terminate();

      setEstado({ fase: "buscando" });

      const res = await fetch("/api/mercado/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoCompleto }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error del servidor (HTTP ${res.status})`);
      }
      const data = await res.json();
      setEstado({
        fase: "listo",
        coincidencias: data.coincidencias,
        sinCoincidencia: data.sinCoincidencia,
      });
    } catch (e) {
      setEstado({
        fase: "error",
        mensaje: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }, []);

  const onFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    setArchivos(list);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mercado</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Sube una o varias capturas del mercado de tu equipo en la app de
          LaLiga Fantasy. Leemos el texto con OCR, buscamos cada jugador en
          el índice de mercado (actualizado a diario desde FútbolFantasy.com)
          y te decimos su subida en el último mercado, tendencia y puja
          máxima rentable.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-neutral-700 p-6 text-center space-y-3">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => onFilesSelected(e.target.files)}
          className="block w-full text-sm text-neutral-300 file:mr-4 file:rounded-md file:border-0 file:bg-neutral-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-neutral-100 hover:file:bg-neutral-700"
        />
        {archivos.length > 0 && (
          <p className="text-xs text-neutral-500">
            {archivos.length} imagen(es) seleccionada(s)
          </p>
        )}
        <button
          onClick={() => procesar(archivos)}
          disabled={archivos.length === 0 || estado.fase === "leyendo" || estado.fase === "buscando"}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {estado.fase === "leyendo"
            ? `Leyendo capturas… ${Math.round((estado.progreso ?? 0) * 100)}%`
            : estado.fase === "buscando"
              ? "Buscando jugadores…"
              : "Analizar capturas"}
        </button>
      </div>

      {estado.fase === "error" && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300 text-sm">
          {estado.mensaje}
        </div>
      )}

      {estado.fase === "listo" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900 text-neutral-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Jugador</th>
                  <th className="px-4 py-3 font-medium">Equipo</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Precio en la captura
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Valor actual (ref.)
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Subida último mercado
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Puja máxima rentable
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {estado.coincidencias.map((c) => (
                  <tr key={c.jugador.id} className="hover:bg-neutral-900/40">
                    <td className="px-4 py-3 font-medium capitalize">
                      {c.jugador.nombre}
                      <div className="text-xs text-neutral-500 font-normal">
                        detectado: &ldquo;{c.linea}&rdquo;
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {c.jugador.equipo ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.precioDetectado ? eur(c.precioDetectado) : "no leído"}
                    </td>
                    <td className="px-4 py-3 text-right">{eur(c.jugador.valor)}</td>
                    <td
                      className={`px-4 py-3 text-right ${
                        (c.jugador.diferenciaPct1d ?? 0) >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {eur(c.jugador.diferencia1d)} ({pct(c.jugador.diferenciaPct1d)})
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.sinRentabilidad ? (
                        <span className="text-red-400">Sin rentabilidad</span>
                      ) : (
                        eur(c.pujaMaximaRentable)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {estado.sinCoincidencia.length > 0 && (
            <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-amber-200 text-sm">
              <p className="font-medium mb-1">
                Líneas que no se pudieron emparejar con ningún jugador:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-300/80">
                {estado.sinCoincidencia.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
