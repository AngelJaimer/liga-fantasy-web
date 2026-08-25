"use client";

import { useState, useCallback } from "react";

type Estado =
  | { fase: "idle" }
  | { fase: "leyendo"; progreso: number }
  | { fase: "procesando" }
  | { fase: "error"; mensaje: string };

export default function SubidaCapturas({
  onResultado,
  textoBoton = "Analizar capturas",
}: {
  onResultado: (textoCompleto: string) => Promise<void> | void;
  textoBoton?: string;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "idle" });
  const [archivos, setArchivos] = useState<File[]>([]);

  const procesar = useCallback(async () => {
    if (archivos.length === 0) return;
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
      for (const file of archivos) {
        const {
          data: { text },
        } = await worker.recognize(file);
        textoCompleto += text + "\n";
      }
      await worker.terminate();

      setEstado({ fase: "procesando" });
      await onResultado(textoCompleto);
      setEstado({ fase: "idle" });
    } catch (e) {
      setEstado({
        fase: "error",
        mensaje: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }, [archivos, onResultado]);

  const ocupado = estado.fase === "leyendo" || estado.fase === "procesando";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-dashed border-neutral-700 p-4 sm:p-6 text-center space-y-3">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setArchivos(e.target.files ? Array.from(e.target.files) : [])}
          className="block w-full text-sm text-neutral-300 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-neutral-100 active:file:bg-neutral-700"
        />
        {archivos.length > 0 && (
          <p className="text-xs text-neutral-500">
            {archivos.length} imagen(es) seleccionada(s)
          </p>
        )}
        <button
          onClick={procesar}
          disabled={archivos.length === 0 || ocupado}
          className="w-full sm:w-auto rounded-md bg-emerald-600 px-4 py-3 sm:py-2 text-sm font-semibold text-white active:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {estado.fase === "leyendo"
            ? `Leyendo capturas… ${Math.round(estado.progreso * 100)}%`
            : estado.fase === "procesando"
              ? "Buscando jugadores…"
              : textoBoton}
        </button>
      </div>

      {estado.fase === "error" && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300 text-sm break-words">
          {estado.mensaje}
        </div>
      )}
    </div>
  );
}
