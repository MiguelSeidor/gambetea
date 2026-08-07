import { renderAppIcon } from "@/lib/appIcon";

// Icono para "Añadir a pantalla de inicio" en iOS (Next lo enlaza como apple-touch-icon).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon(180);
}
