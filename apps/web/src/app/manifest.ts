import type { MetadataRoute } from "next";

// Manifest de la PWA: permite "instalar" Gambetea en la pantalla de inicio y abrirla a pantalla
// completa (display: standalone), como una app. Next lo sirve en /manifest.webmanifest y añade
// solo el <link rel="manifest">.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gambetea",
    short_name: "Gambetea",
    description: "Fantasy de fútbol con una gambeta nueva: jugadores, entrenadores y tu propio estadio.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es",
    dir: "ltr",
    background_color: "#08070B",
    theme_color: "#08070B",
    categories: ["sports", "games"],
    icons: [
      { src: "/manifest-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/manifest-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/manifest-icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
