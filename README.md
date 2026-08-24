# Liga Fantasy 2026/27

Web para la liga fantasy del grupo: premios acumulados (leídos en vivo del
Google Sheet de la liga) y una herramienta de mercado (sube capturas de tu
mercado en LaLiga Fantasy, se leen por OCR y se enriquecen con datos
públicos de mercado).

## Cómo funciona

- **`/`** — lee la pestaña "Liga" del Google Sheet vía su export CSV público
  (`gviz`), sin necesidad de credenciales — el Sheet solo tiene que estar
  compartido como "cualquiera con el enlace: lector" (ya lo está).
- **`/mercado`** — subes una o varias capturas de pantalla, se leen con OCR
  en el propio navegador ([tesseract.js](https://github.com/naptha/tesseract.js)),
  y el texto detectado se empareja (fuzzy match) contra un índice de ~670
  jugadores de LaLiga Fantasy Oficial. Ese índice se scrapea a diario de
  [FútbolFantasy.com](https://www.futbolfantasy.com/analytics/laliga-fantasy/mercado)
  (dato público, sin login) vía un workflow de GitHub Actions
  (`.github/workflows/update-mercado.yml`) que comitea `data/mercado.json`.
  La "puja máxima rentable" y el histórico de 30 días se piden puntualmente
  por jugador cuando hace falta (no en el scrape diario, para no golpear la
  web con 670 peticiones cada día).

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
cp .env.local.example .env.local   # y rellena GOOGLE_SHEET_ID
node scripts/scrape-mercado.mjs    # genera data/mercado.json la primera vez
npm run dev
```

## Variables de entorno

| Variable          | Qué es                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `GOOGLE_SHEET_ID` | ID del Google Sheet de la liga (la parte de la URL entre `/d/` y `/edit`) |

## Pendiente / ideas para más adelante

- Persistir las capturas subidas y su resultado (hoy todo vive solo en la
  sesión del navegador).
- Guardar histórico propio de "mi mercado" por jornada.
- Si algún día compensa, migrar el índice de mercado a la API oficial de
  LaLiga Fantasy usando un token renovado periódicamente.
