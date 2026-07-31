"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { api, type AdBoard, type StadiumView } from "@/lib/api";
import { eur } from "@/lib/format";

// Las imágenes tienen extensiones distintas por nivel (0-8 jpeg, 9 png, 10-13 jpg, 14 premium jpg).
function stadiumImage(level: number): string {
  if (level >= 14) return "/brand/stadium/level-14-premium.jpg";
  if (level >= 10) return `/brand/stadium/level-${level}.jpg`;
  if (level === 9) return "/brand/stadium/level-9.png";
  return `/brand/stadium/level-${level}.jpeg`;
}

export default function Estadio() {
  const { leagueId, team, refresh } = useApp();
  const [stadium, setStadium] = useState<StadiumView | null>(null);
  const [boards, setBoards] = useState<AdBoard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const [s, b] = await Promise.all([api.stadium(leagueId), api.boards(leagueId)]);
    setStadium(s);
    setBoards(b);
  }, [leagueId]);
  useEffect(() => { void load(); }, [load]);

  async function genOffers() {
    setBusy(true);
    try {
      setBoards(await api.generateOffers(leagueId));
      notify("Nuevas ofertas de patrocinio", true);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", false);
    } finally {
      setBusy(false);
    }
  }

  async function accept(offerId: string) {
    setBusy(true);
    try {
      setBoards(await api.acceptOffer(leagueId, offerId));
      await refresh();
      notify("Patrocinio firmado · ingreso recibido", true);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", false);
    } finally {
      setBusy(false);
    }
  }

  function notify(text: string, ok: boolean) {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 2800);
  }

  async function upgrade() {
    setBusy(true);
    try {
      const s = await api.upgradeStadium(leagueId);
      setStadium(s);
      await refresh();
      notify(`¡Mejora completada! Ahora ${eur(s.rate)} por punto`, true);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", false);
    } finally {
      setBusy(false);
    }
  }

  if (!stadium) return null;
  const canAfford = stadium.next ? (team?.budget ?? 0) >= stadium.next.cost : false;
  const shownLevel = preview ?? stadium.level;
  const shownName = stadium.progression.find((t) => t.level === shownLevel)?.name ?? stadium.name;

  return (
    <>
      <div className="stadium-top">
        <div className="page-head" style={{ margin: 0 }}>
          <span className="eb">Tu casa, tu ventaja</span>
          <h1>{stadium.name}</h1>
          <p>Cada mejora sube el ingreso por <b>asistencia</b>: ganas más dinero por cada punto que logra tu equipo cada jornada.</p>
        </div>

        <div className="stadium-hero">
        <img src={stadiumImage(shownLevel)} alt={`${shownName} (nivel ${shownLevel})`} />
        {preview !== null && preview !== stadium.level && (
          <button className="sh-preview" onClick={() => setPreview(null)}>Vista previa · volver a tu estadio</button>
        )}
        </div>
      </div>

      <div className="stadium-strip">
        {stadium.progression.map((t) => (
          <button
            key={t.level}
            className={`st-thumb${t.level === shownLevel ? " on" : ""}${t.level === stadium.level ? " mine" : ""}`}
            onClick={() => setPreview(t.level)}
            title={`${t.name} · nivel ${t.level}`}
          >
            <img src={stadiumImage(t.level)} alt={t.name} loading="lazy" />
            <span>{t.level}</span>
          </button>
        ))}
      </div>

      <div className="grid g-3">
        <div className="tile"><span className="k">Nivel</span><div className="v">{stadium.level}</div><div className="d">de {stadium.maxLevel}</div></div>
        <div className="tile"><span className="k">Asistencia</span><div className="v">{eur(stadium.rate)}</div><div className="d up">por punto / jornada</div></div>
        <div className="tile">
          <span className="k">Próxima mejora</span>
          <div className="v" style={{ fontSize: "1.4rem" }}>{stadium.next ? stadium.next.name : "Máximo"}</div>
          <div className="d">{stadium.next ? `${eur(stadium.next.cost)} → ${eur(stadium.rate + 2000)}/punto` : "estadio completo"}</div>
        </div>
      </div>

      {stadium.next && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ fontSize: "1.05rem" }}>{stadium.next.name}</h3>
            <p className="muted" style={{ fontSize: ".85rem", marginTop: 4 }}>
              Coste {eur(stadium.next.cost)} · sube la asistencia a {eur(stadium.rate + 2000)} por punto.
            </p>
          </div>
          <button className="btn" onClick={upgrade} disabled={busy || !canAfford}>
            <span>{busy ? "Mejorando…" : canAfford ? "Mejorar estadio" : "Saldo insuficiente"}</span>
          </button>
        </div>
      )}

      <div className="card-head" style={{ marginBottom: 0 }}><h3>Progresión</h3></div>
      <div className="card pad0">
        <table className="table">
          <thead><tr><th>Nivel</th><th>Mejora</th><th style={{ textAlign: "right" }}>Coste</th><th style={{ textAlign: "right" }}>€/punto</th><th style={{ textAlign: "right" }}>Estado</th></tr></thead>
          <tbody>
            {stadium.progression.map((t) => (
              <tr key={t.level} className={t.level === shownLevel ? "you" : ""} style={{ cursor: "pointer" }}
                onClick={() => setPreview(t.level)} title="Ver esta fase">
                <td className="rank">{t.level}</td>
                <td>{t.name}</td>
                <td className="num">{t.cost > 0 ? eur(t.cost) : "—"}</td>
                <td className="num">{eur(t.rate)}</td>
                <td className="num">
                  {t.level < stadium.level ? <span className="badge fit">Hecha</span>
                    : t.level === stadium.level ? <span className="badge">Actual</span>
                    : <span className="muted" style={{ fontSize: ".8rem" }}>Bloqueada</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card-head" style={{ marginBottom: 0, marginTop: 8 }}>
        <h3>Vallas publicitarias</h3>
      </div>
      <div className="dev-tools">
        <span className="dl">Ofertas de patrocinio (dev)</span>
        <span className="muted" style={{ fontSize: ".78rem" }}>En producción las ofertas llegan solas por temporada; este botón no aparecerá en la app final.</span>
        <button className="btn-sm ghost" disabled={busy} onClick={genOffers}>Generar ofertas</button>
      </div>
      <div className="grid g-4">
        {boards?.map((b) => (
          <div className="card" key={b.side}>
            <div className="card-head"><h3 style={{ fontSize: "1rem" }}>Valla {b.label}</h3></div>
            {b.contract ? (
              <>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{b.contract.brand}</div>
                <div className="muted" style={{ fontSize: ".82rem", marginTop: 4 }}>Patrocinador · {eur(b.contract.amount)} / temporada</div>
                <span className="badge fit" style={{ marginTop: 12, display: "inline-block" }}>Contratada</span>
              </>
            ) : b.offer ? (
              <>
                <div className="muted" style={{ fontSize: ".82rem" }}>Oferta de</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{b.offer.brand}</div>
                <div className="mkt-meta"><div className="m"><div className="l">Importe</div><div className="val">{eur(b.offer.amount)}</div></div></div>
                <button className="btn-sm" disabled={busy} onClick={() => accept(b.offer!.id)}>Aceptar</button>
              </>
            ) : (
              <p className="muted" style={{ fontSize: ".85rem" }}>Sin ofertas. Pulsa «Generar ofertas».</p>
            )}
          </div>
        ))}
      </div>

      {toast && <div className={`toast ${toast.ok ? "ok" : "err"}`}>{toast.text}</div>}
    </>
  );
}
