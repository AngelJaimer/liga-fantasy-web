// El mercado del juego se recalcula una vez al día; el grupo observa que
// pasa sobre las 14:06 hora de Nueva York. Lo que se detecta en una
// captura solo tiene sentido hasta el siguiente reinicio — pasado ese
// punto son precios del mercado anterior. En vez de borrar nada con un
// cron, cada lectura simplemente ignora todo lo de antes del último
// reinicio.

const ZONA = "America/New_York";
const HORA_RESET = 14;
const MINUTO_RESET = 6;

function offsetMinutosZona(fecha: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    timeZoneName: "shortOffset",
  }).formatToParts(fecha);
  const nombre = partes.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const m = nombre.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!m) return 0;
  const horas = Number(m[1]);
  const minutos = m[2] ? Number(m[2]) : 0;
  return (horas < 0 ? -1 : 1) * (Math.abs(horas) * 60 + minutos);
}

/** Instante (UTC) del último reinicio del mercado, en o antes de `ahora`. */
export function inicioCicloMercado(ahora: Date = new Date()): Date {
  const offsetMin = offsetMinutosZona(ahora, ZONA);
  const localMillis = ahora.getTime() + offsetMin * 60_000;
  const local = new Date(localMillis);
  const minutosDelDia = local.getUTCHours() * 60 + local.getUTCMinutes();
  const resetMinutos = HORA_RESET * 60 + MINUTO_RESET;

  const diaBase =
    minutosDelDia >= resetMinutos
      ? local
      : new Date(localMillis - 24 * 60 * 60_000);

  const inicioLocalMillis = Date.UTC(
    diaBase.getUTCFullYear(),
    diaBase.getUTCMonth(),
    diaBase.getUTCDate(),
    HORA_RESET,
    MINUTO_RESET,
    0
  );
  // offset puede variar ligerísimamente cerca de un cambio de DST; para
  // esto (una ventana de frescura de datos, no algo crítico) es sobrado.
  return new Date(inicioLocalMillis - offsetMin * 60_000);
}
