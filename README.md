# Liga Fantasy 2026/27

Web para la liga fantasy del grupo: premios acumulados (leídos en vivo del
Google Sheet de la liga), el mercado del día compartido por todo el grupo
(sube capturas, se leen por OCR y se enriquecen con datos de referencia) y
un análisis privado de a quién robarle la plantilla.

**En vivo:** https://angeljaimer.github.io/liga-fantasy-web/ (pide la
contraseña del grupo).

## Cómo funciona

Es un sitio **100% estático** (Next.js con `output: "export"`, publicado en
GitHub Pages) — no hay servidor propio corriendo en ningún sitio.

- **`/`** — al cargar, el navegador pide directamente la pestaña "Liga" del
  Google Sheet vía su export CSV público (`gviz`), sin credenciales — el
  Sheet solo tiene que estar compartido como "cualquiera con el enlace:
  lector" (ya lo está).
- **`/mercado`** — muestra el mercado del día, compartido por todo el
  grupo. Subes una o varias capturas, se leen con OCR en el propio
  navegador ([tesseract.js](https://github.com/naptha/tesseract.js)), los
  nombres detectados se emparejan contra el índice de ~670 jugadores de
  LaLiga Fantasy Oficial, y solo el **resultado** (qué jugadores estaban
  hoy en el mercado) se guarda en una base de datos compartida (Firestore)
  — nunca la captura en sí, nunca quién la subió. Se reinicia solo cada
  ciclo de mercado (~14:06 hora de Nueva York): cualquier dato de un ciclo
  anterior se ignora al leer, sin necesidad de borrar nada (ver
  `lib/marketCycle.ts`).
- **`/robar`** — sube capturas de la plantilla de un rival y la ordena por
  potencial de crecimiento. Esto es **privado**: todo pasa en tu propio
  navegador, nunca se sube ni se comparte con nadie — a diferencia del
  mercado, aquí sí que puede haber ofertas o info que no quieres que vea
  el resto del grupo.
- **Ese índice de referencia se scrapea a diario** de
  [FútbolFantasy.com](https://www.futbolfantasy.com/analytics/laliga-fantasy/mercado)
  (dato público, sin login) vía un workflow de GitHub Actions
  (`.github/workflows/deploy.yml`) que corre el scraper, comitea
  `public/mercado.json` y reconstruye + republica el sitio — cada día, y
  también en cada push a `main`.
- **Un gate de contraseña** (`components/PasswordGate.tsx`) protege todo el
  sitio — no es seguridad real (el sitio es estático y público, cualquiera
  con paciencia podría sacar el hash del JS servido), solo un filtro para
  que no entre cualquiera que se tropiece con el enlace.

## Base de datos compartida (Firestore)

`/mercado` necesita que lo que sube una persona lo vea el resto — un sitio
100% estático no puede compartir datos entre navegadores distintos por sí
solo, así que hay un proyecto de Firebase (`liga-fantasy-web`, plan
gratuito Spark) solo para esto:

- Colección `mercadoDia`, un documento por jugador: `{ jugadorId,
  ultimaVezVisto }`. Nada más — ni el nombre en texto, ni la captura, ni
  quién la subió.
- Las reglas de seguridad (consola de Firebase → Firestore → Rules)
  permiten lectura pública y solo permiten escribir con esa forma exacta
  de documento — no cualquier cosa.
- La `apiKey` en `lib/firebase.ts` no es secreta (así funcionan las apps
  web de Firebase: la protección la dan las reglas, no ocultar la key), así
  que va directa en el código, sin variable de entorno.
- `/robar` no toca esta base de datos para nada — todo se queda en el
  navegador de quien la usa.

## Por qué la puja máxima rentable no se pide en vivo

Se probó primero a pedir el detalle de cada jugador (puja máxima rentable,
máximo/mínimo de 30 días) desde el propio navegador, al vuelo, cuando subes
una captura. **No funciona de forma fiable**: FútbolFantasy.com bloquea las
peticiones `fetch()` hechas desde JS de navegador a esas páginas — dan
`Failed to fetch`, probablemente por su protección anti-bot/WAF — mientras
que una petición Node o `curl` sin huella de navegador funciona sin
problema. Como el sitio es estático (sin servidor propio de por medio), la
única forma fiable de tener ese dato es precalcularlo en el scraper diario
(que corre en Node vía GitHub Actions) y servirlo ya horneado en
`mercado.json`. El scraper además rate-limita sus propias peticiones (se
midió: 12 en paralelo provocaba HTTP 429 en el 95% de los casos) — va
secuencial con pausa entre peticiones y reintentos con espera creciente.

## Por qué esta fuente y no la API oficial de LaLiga Fantasy

La API oficial (`api-fantasy.llt-services.com`) existe y funciona, pero el
login de esta cuenta es solo por Google/app — sacar un token requiere
interceptar el tráfico del móvil (ver `../fantasy-scout/scout.py`, un
experimento anterior) y ese token expira, así que no es viable para una web
que se quede funcionando sola. FútbolFantasy.com expone los mismos valores
de mercado en una página pública sin login; `robots.txt` no la bloquea. Es
scraping de un tercero sin API documentada — puede romperse si cambian el
HTML — pero para un proyecto pequeño entre amigos, con una consulta diaria,
es lo más razonable.

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local   # y rellena NEXT_PUBLIC_GOOGLE_SHEET_ID
node scripts/scrape-mercado.mjs    # genera public/mercado.json (tarda varios minutos)
npm run dev
```

Para ver el sitio tal cual lo serviría GitHub Pages (con el prefijo de ruta
`/liga-fantasy-web/`), hay que compilar y servir el export:

```bash
npm run build   # genera out/
# servir out/ bajo una ruta /liga-fantasy-web/ con cualquier servidor estático
```

## Variables de entorno

| Variable                      | Qué es                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_GOOGLE_SHEET_ID` | ID del Google Sheet de la liga (la parte de la URL entre `/d/` y `/edit`). Es pública a propósito: el sitio es estático y la lee desde el navegador, y el Sheet ya es visible por enlace de todas formas. |

En CI (GitHub Actions) esto viene de la variable de repo `GOOGLE_SHEET_ID`
(`gh variable set GOOGLE_SHEET_ID --body "..."`), no de un secret — mismo
motivo, no es un dato sensible.

## Cambiar la contraseña de acceso

Está en `components/PasswordGate.tsx` como un hash SHA-256, para que no
quede en texto plano a simple vista en el repo. Para cambiarla:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('TU_NUEVA_CONTRASEÑA').digest('hex'))"
```

y pega el resultado en `PASSWORD_HASH_SHA256`.

## Pendiente / ideas para más adelante

- Persistir las capturas subidas y su resultado (hoy todo vive solo en la
  sesión del navegador).
- Guardar histórico propio de "mi mercado" por jornada.
- Si algún día compensa, migrar el índice de mercado a la API oficial de
  LaLiga Fantasy usando un token renovado periódicamente.
