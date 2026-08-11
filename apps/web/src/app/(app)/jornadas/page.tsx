"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/Icon";
import { api, POS_SHORT, type PlayerPos, type TeamGameweekDetail, type TeamGameweekRow } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: "Por jugar", OPEN: "Por jugar", LOCKED: "En juego", FINISHED: "Finalizada",
};

export default function Jornadas() {
  const { leagueId } = useApp();
  const [rows, setRows] = useState<TeamGameweekRow[] | null>(null);
  const [openGw, setOpenGw] = useState<string | null>(null);
  const [detail, setDetail] = useState<TeamGameweekDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);

  const load = useCallback(async () => setRows(await api.teamGameweeks(leagueId)), [leagueId]);
  useEffect(() => { void load(); }, [load]);

  async function toggle(gw: TeamGameweekRow) {
    if (openGw === gw.gameweekId) { setOpenGw(null); setDetail(null); return; }
    setOpenGw(gw.gameweekId);
    setDetail(null);
    setOpenPlayer(null);
    if (gw.status === "FINISHED") {
      setLoadingDetail(true);
      try { setDetail(await api.teamGameweek(leagueId, gw.gameweekId)); }
      catch { setDetail(null); }
      finally { setLoadingDetail(false); }
    }
  }

  const played = rows?.filter((r) => r.points !== null) ?? [];
  const totalPts = played.reduce((s, r) => s + (r.eligible ? (r.points ?? 0) : 0), 0);

  return (
    <>
      <div className="page-head">
        <span className="eb">Registro de jornadas</span>
        <h1>Jornadas</h1>
        <p>Tus puntos jornada a jornada. Abre una jornada finalizada para ver quién puntuó y el desglose exacto de cada jugador.</p>
      </div>

      <div className="grid g-3">
        <div className="tile"><span className="k">Jornadas jugadas</span><div className="v">{played.length}</div></div>
        <div className="tile"><span className="k">Puntos totales</span><div className="v">{totalPts}</div><div className="d">solo jornadas elegibles</div></div>
        <div className="tile"><span className="k">Media</span><div className="v">{played.length ? Math.round(totalPts / played.length) : 0}</div><div className="d">pts / jornada</div></div>
      </div>

      <div className="card pad0">
        {!rows && <p className="muted" style={{ padding: 22 }}>Cargando…</p>}
        {rows?.length === 0 && <p className="muted" style={{ padding: 22 }}>No hay jornadas todavía.</p>}
        {rows?.map((gw) => {
          const isOpen = openGw === gw.gameweekId;
          const finished = gw.status === "FINISHED";
          return (
            <div key={gw.gameweekId} className={`gw-item${isOpen ? " open" : ""}`}>
              <button className="gw-row" onClick={() => void toggle(gw)} aria-expanded={isOpen}>
                <span className="gw-n">J{gw.number}</span>
                <span className={`badge ${finished ? "fit" : ""}`}>{STATUS_LABEL[gw.status] ?? gw.status}</span>
                <span className="gw-pts">
                  {gw.points === null
                    ? <span className="muted">—</span>
                    : <><b>{gw.points}</b> pts{gw.eligible === false && <small className="muted"> · en rojo, no cuenta</small>}</>}
                </span>
                {finished && <span className={`gw-chev${isOpen ? " open" : ""}`}><Icon name="chevron" size={16} /></span>}
              </button>

              {isOpen && (
                <div className="gw-detail">
                  {!finished && <p className="muted" style={{ margin: 0 }}>Esta jornada aún no se ha jugado.</p>}
                  {finished && loadingDetail && <p className="muted" style={{ margin: 0 }}>Cargando desglose…</p>}
                  {finished && !loadingDetail && !detail && <p className="muted" style={{ margin: 0 }}>No hay alineación registrada para esta jornada.</p>}
                  {finished && detail && (
                    <>
                      <div className="gw-detail-head">
                        <span>Formación <b>{detail.formation}</b></span>
                        <span>Total <b style={{ color: "var(--accent)" }}>{detail.total ?? 0}</b> pts</span>
                      </div>
                      {[...detail.starters, ...detail.bench].map((pl, idx) => {
                        const isBench = idx >= detail.starters.length;
                        const pOpen = openPlayer === pl.id;
                        return (
                          <div key={pl.id} className={`gw-pl${isBench ? " bench" : ""}`}>
                            <button className="gw-pl-row" onClick={() => setOpenPlayer(pOpen ? null : pl.id)} aria-expanded={pOpen}>
                              <span className={`pos ${pl.position}`}>{POS_SHORT[pl.position as PlayerPos] ?? pl.position}</span>
                              <span className="gw-pl-name">
                                {pl.name}
                                {pl.isCaptain && <span className="cap" title="Capitán">C</span>}
                                {isBench && <small className="muted"> · banquillo</small>}
                              </span>
                              <span className="gw-pl-pts" style={{ color: pl.points >= 0 ? "var(--ink)" : "#f87171" }}>{pl.points} pts</span>
                              <span className={`gw-chev${pOpen ? " open" : ""}`}><Icon name="chevron" size={14} /></span>
                            </button>
                            {pOpen && (
                              <div className="gw-bd">
                                {pl.breakdown.length === 0 && <div className="muted" style={{ fontSize: ".82rem" }}>Sin puntos (no jugó o sin acciones puntuables).</div>}
                                {pl.breakdown.map((b) => (
                                  <div className="gw-bd-row" key={b.key}>
                                    <span>{b.label}{b.qty > 1 ? ` ×${b.qty}` : ""}</span>
                                    <span style={{ color: b.points >= 0 ? "#4ade80" : "#f87171", fontVariantNumeric: "tabular-nums" }}>
                                      {b.points >= 0 ? "+" : ""}{b.points}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {detail.coach && (
                        <div className="gw-pl">
                          <button className="gw-pl-row" onClick={() => setOpenPlayer(openPlayer === detail.coach!.id ? null : detail.coach!.id)} aria-expanded={openPlayer === detail.coach.id}>
                            <span className="pos DT">ENT</span>
                            <span className="gw-pl-name">{detail.coach.name} <small className="muted">· entrenador</small></span>
                            <span className="gw-pl-pts" style={{ color: detail.coach.points >= 0 ? "var(--ink)" : "#f87171" }}>{detail.coach.points} pts</span>
                            <span className={`gw-chev${openPlayer === detail.coach.id ? " open" : ""}`}><Icon name="chevron" size={14} /></span>
                          </button>
                          {openPlayer === detail.coach.id && (
                            <div className="gw-bd">
                              {detail.coach.breakdown.length === 0 && <div className="muted" style={{ fontSize: ".82rem" }}>Sin puntos.</div>}
                              {detail.coach.breakdown.map((b) => (
                                <div className="gw-bd-row" key={b.key}>
                                  <span>{b.label}{b.qty > 1 ? ` ×${b.qty}` : ""}</span>
                                  <span style={{ color: b.points >= 0 ? "#4ade80" : "#f87171", fontVariantNumeric: "tabular-nums" }}>
                                    {b.points >= 0 ? "+" : ""}{b.points}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
