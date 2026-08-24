"use client";

import { useEffect, useState, type FormEvent } from "react";

// Esto NO es seguridad de verdad: el sitio es estático y público, así que
// cualquiera con ganas puede leer este hash en el JS servido y, con tiempo,
// probar contraseñas hasta dar con ella. Es solo un filtro para que no
// entre cualquiera que se tropiece con el enlace — el sitio en sí no tiene
// datos sensibles (apuestas de fútbol entre amigos).
const PASSWORD_HASH_SHA256 =
  "548b7068b87e4982fbf84a1eb39edf15981665719b575a5df3d1cd30c1efa425";
const STORAGE_KEY = "liga-fantasy-unlocked";

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [comprobando, setComprobando] = useState(true);
  const [valor, setValor] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    // sessionStorage no existe durante el build estático (Node, sin
    // window) — hay que leerlo tras el montaje en el cliente para no
    // desincronizar el HTML exportado del primer render en el navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesbloqueado(sessionStorage.getItem(STORAGE_KEY) === "1");
    setComprobando(false);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const hash = await sha256Hex(valor.trim());
    if (hash === PASSWORD_HASH_SHA256) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setDesbloqueado(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (comprobando) return null;

  if (!desbloqueado) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-800 bg-neutral-900/60 p-6"
        >
          <div>
            <h1 className="text-lg font-semibold">⚽ Liga Fantasy</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Solo para el grupo — pide la contraseña si no la tienes.
            </p>
          </div>
          <input
            type="password"
            autoFocus
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              setError(false);
            }}
            placeholder="Contraseña"
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500"
          />
          {error && (
            <p className="text-sm text-red-400">Contraseña incorrecta.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
