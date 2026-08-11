import { eur } from "@/lib/format";

/** Muestra la variación diaria del valor de mercado (ADR-022): ↑ verde / ↓ rojo / — sin cambio. */
export default function ValueDelta({ delta, size = ".72rem" }: { delta: number; size?: string }) {
  if (!delta) return <span className="muted" style={{ fontSize: size }}> · —</span>;
  const up = delta > 0;
  return (
    <span
      style={{ fontSize: size, color: up ? "#4ade80" : "#f87171", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
      title={`${up ? "Subió" : "Bajó"} ${eur(Math.abs(delta))} en el último recálculo`}
    >
      {" "}{up ? "▲" : "▼"} {eur(Math.abs(delta))}
    </span>
  );
}
