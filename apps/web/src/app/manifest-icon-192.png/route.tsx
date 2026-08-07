import { renderAppIcon } from "@/lib/appIcon";

// Icono PWA 192x192 (URL estable para el manifest).
export const dynamic = "force-static";

export function GET() {
  return renderAppIcon(192);
}
