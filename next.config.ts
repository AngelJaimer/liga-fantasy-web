import path from "node:path";
import type { NextConfig } from "next";

// GitHub Pages sirve el repo bajo /<nombre-del-repo>/, así que hay que
// avisar a Next del prefijo (basePath) para que las rutas y los assets
// estáticos (public/mercado.json incluido) se resuelvan bien.
const BASE_PATH = "/liga-fantasy-web";

const nextConfig: NextConfig = {
  output: "export",
  basePath: BASE_PATH,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
