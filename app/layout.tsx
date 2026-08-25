import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import PasswordGate from "@/components/PasswordGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Liga Fantasy 2026/27",
  description: "Premios de la liga y mercado de LaLiga Fantasy para el grupo",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

const LINKS = [
  { href: "/", label: "Premios" },
  { href: "/mercado", label: "Mercado" },
  { href: "/robar", label: "Robar" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <PasswordGate>
          <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur sticky top-0 z-10">
            <nav className="max-w-5xl mx-auto flex items-center gap-1 px-3 py-2.5 overflow-x-auto">
              <Link
                href="/"
                className="font-semibold tracking-tight text-sm sm:text-base shrink-0 px-2 py-1.5"
              >
                ⚽ Liga
              </Link>
              <div className="ml-auto flex items-center gap-1">
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="text-sm text-neutral-300 active:text-white active:bg-neutral-800 transition rounded-md px-3 py-1.5 shrink-0"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>
          <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 py-6 sm:py-8">
            {children}
          </main>
          <footer className="border-t border-neutral-800 py-4 text-center text-[11px] text-neutral-500 px-3">
            Datos de mercado agregados desde FútbolFantasy.com · Premios
            desde el Google Sheet de la liga
          </footer>
        </PasswordGate>
      </body>
    </html>
  );
}
