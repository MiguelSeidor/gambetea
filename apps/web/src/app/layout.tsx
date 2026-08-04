import type { Metadata } from "next";
import { Anton, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import Maintenance from "@/components/Maintenance";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gambetea — Juega distinto",
  description:
    "El Fantasy de fútbol de siempre, con una gambeta nueva: no solo fichas jugadores, también entrenadores y construyes tu propio estadio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${anton.variable} ${hanken.variable}`}>
      <body>
        <noscript>
          <style>{`.rise{transform:none!important}.fadeup{opacity:1!important;transform:none!important}.rv{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        {process.env.MAINTENANCE === "1" ? <Maintenance /> : children}
      </body>
    </html>
  );
}
