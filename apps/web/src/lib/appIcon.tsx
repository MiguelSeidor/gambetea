import { ImageResponse } from "next/og";

/**
 * Genera el icono de app de Gambetea como PNG (monograma "G" naranja sobre fondo oscuro),
 * coherente con `favicon.svg`. Se usa para el apple-touch-icon y los iconos del manifest (PWA).
 * `maskable`: la "G" va más pequeña (zona segura ~80%) y el fondo llega a los bordes, para que
 * Android pueda recortar el icono a su forma sin comerse el logo.
 */
export function renderAppIcon(size: number, opts: { maskable?: boolean } = {}) {
  const maskable = opts.maskable ?? false;
  const glyph = Math.round(size * (maskable ? 0.5 : 0.6));
  const radius = maskable ? 0 : Math.round(size * 0.22);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius,
          background: "radial-gradient(circle at 50% 36%, #1b1421 0%, #0A0910 70%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: glyph,
            fontWeight: 800,
            lineHeight: 1,
            color: "#FF6A2C",
            marginTop: -Math.round(size * 0.03),
          }}
        >
          G
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
