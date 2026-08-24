import type { Metadata } from "next";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <PasswordGate>
          <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur sticky top-0 z-10">
            <nav className="max-w-5xl mx-auto flex items-center gap-6 px-4 py-3">
              <Link href="/" className="font-semibold tracking-tight">
                ⚽ Liga Fantasy
              </Link>
              <Link
                href="/"
                className="text-sm text-neutral-300 hover:text-white transition"
              >
                Premios
              </Link>
              <Link
                href="/mercado"
                className="text-sm text-neutral-300 hover:text-white transition"
              >
                Mercado
              </Link>
            </nav>
          </header>
          <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="border-t border-neutral-800 py-4 text-center text-xs text-neutral-500">
            Datos de mercado agregados desde FútbolFantasy.com · Premios
            desde el Google Sheet de la liga
          </footer>
        </PasswordGate>
      </body>
    </html>
  );
}
