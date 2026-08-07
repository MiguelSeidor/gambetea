import { renderAppIcon } from "@/lib/appIcon";

// Icono PWA 512x512 "maskable" (Android lo recorta a su forma; el logo va en la zona segura).
export const dynamic = "force-static";

export function GET() {
  return renderAppIcon(512, { maskable: true });
}
