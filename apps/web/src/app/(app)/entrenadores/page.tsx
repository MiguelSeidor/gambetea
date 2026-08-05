"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import TeamCrest from "@/components/TeamCrest";
import { useApp } from "@/components/AppProvider";
import { eur } from "@/lib/format";

export default function Entrenadores() {
  const { team } = useApp();
  if (!team) return null;
  const coaches = team.coaches;
  const best = coaches.reduce((a, c) => (c.points > (a?.points ?? -Infinity) ? c : a), coaches[0]);

  return (
    <>
      <div className="page-head">
        <span className="eb">La pieza que nadie tiene</span>
        <h1>Entrenadores</h1>
        <p>Tus entrenadores puntúan con un algoritmo propio: tu banquillo también juega el partido. Se fichan y venden en el <Link href="/mercado">Mercado</Link>; no tienen cláusula.</p>
      </div>

      {best && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <span className="badge-c" style={{ width: 56, height: 56, borderRadius: 14, display: "grid", placeItems: "center", color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}>
            <Icon name="coach" size={26} />
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="muted" style={{ fontFamily: "var(--mono)", fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase" }}>Tu mejor entrenador</div>
            <div style={{ fontFamily: "var(--disp)", fontSize: "1.8rem", textTransform: "uppercase", lineHeight: 1 }}>{best.name}</div>
            <div className="muted" style={{ fontSize: ".85rem", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}><TeamCrest teamId={best.teamId} name={best.clubName} short={best.club} size={20} />{best.clubName ?? best.club ?? "—"} · valor {eur(best.value)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--disp)", fontSize: "2.4rem", color: "var(--accent)", lineHeight: 1 }}>{best.points}</div>
            <div className="muted" style={{ fontSize: ".78rem" }}>puntos esta temporada</div>
          </div>
        </div>
      )}

      <div className="card-head" style={{ marginBottom: 0 }}>
        <h3>Tus entrenadores ({coaches.length})</h3>
        <Link href="/mercado">Fichar en el mercado</Link>
      </div>
      {coaches.length === 0 ? (
        <div className="card"><p className="muted">No tienes entrenadores. Fíchalos en el <Link href="/mercado">Mercado</Link>.</p></div>
      ) : (
        <div className="grid g-4">
          {coaches.map((c) => (
            <div className="coach-card" key={c.id}>
              <div className="ch">
                <span className="badge-c"><Icon name="coach" /></span>
                <div><h4>{c.name}</h4><div className="st" style={{ display: "flex", alignItems: "center", gap: 6 }}><TeamCrest teamId={c.teamId} name={c.clubName} short={c.club} />{c.clubName ?? c.club ?? "—"}</div></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 }}>
                <span style={{ fontFamily: "var(--disp)", fontSize: "1.6rem" }}>{c.points} <small className="muted" style={{ fontFamily: "var(--sans)", fontSize: ".7rem" }}>pts</small></span>
                <span className="muted" style={{ fontSize: ".82rem" }}>{eur(c.value)}</span>
              </div>
              <div className="muted" style={{ fontSize: ".76rem", marginTop: 4 }}>Comprado por {eur(c.purchasePrice)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
