"use client";

import { useState } from "react";
import { crestUrl } from "@/lib/api";

/**
 * Escudo del equipo servido por NUESTRO backend (proxy, regla de oro nº3). Muestra la imagen y,
 * al pasar el ratón, el nombre completo del club. Si no hay equipo o la imagen falla, cae con
 * elegancia al código corto ("LEG"). El código corto se pasa como `short`.
 */
export default function TeamCrest({
  teamId,
  name,
  short,
  size = 18,
}: {
  teamId: string | null | undefined;
  name?: string | null;
  short?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = crestUrl(teamId);
  const label = name ?? short ?? "";

  if (!src || failed) {
    return (
      <span className="crest-fallback" title={label || undefined}>
        {short ?? "—"}
      </span>
    );
  }
  return (
    // Imagen dinámica servida por nuestro proxy; next/image no aporta aquí (mismo origen, cacheada).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="crest"
      src={src}
      alt={label}
      title={label || undefined}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
