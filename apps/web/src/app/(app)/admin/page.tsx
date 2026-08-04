"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Modal from "@/components/Modal";
import { api, type AdminOverview, type AdminTeamDetail, type HubStatus, type PlayerPos } from "@/lib/api";

const eur = (n: number) => new Intl.NumberFormat("es-ES").format(n) + " €";
const POSITIONS: PlayerPos[] = ["GK", "DEF", "MID", "FWD"];

export default function AdminPanel() {
  const { user } = useApp();
  const [ov, setOv] = useState<AdminOverview | null>(null);
  const [teamId, setTeamId] = useState<string>("");
  const [detail, setDetail] = useState<AdminTeamDetail | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof api.adminAudit>> | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Formularios
  const [money, setMoney] = useState({ amount: 1000000, reason: "" });
  const [recomputeGw, setRecomputeGw] = useState("");
  const [score, setScore] = useState({ gameweekId: "", points: 0 });
  // Ciclo de vida del jugador (ADR-018) — confirmación destructiva
  const [hub, setHub] = useState<{ playerId: string; name: string; kind: "transferOut" | "retire" } | null>(null);
  // Gestión del Hub (ADR-019)
  const [hubStatus, setHubStatus] = useState<HubStatus | null>(null);
  const [playCount, setPlayCount] = useState(1);
  const [resetOpen, setResetOpen] = useState(false);

  const notify = (text: string, ok: boolean) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3000);
  };
  const run = async (fn: () => Promise<void>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      notify(okMsg, true);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error", false);
    } finally {
      setBusy(false);
    }
  };

  const loadOverview = useCallback(async () => {
    const [o, a, h] = await Promise.all([api.adminOverview(), api.adminAudit(), api.adminHubStatus()]);
    setOv(o);
    setAudit(a);
    setHubStatus(h);
  }, []);
  useEffect(() => {
    if (user.isAdmin) void loadOverview();
  }, [user.isAdmin, loadOverview]);

  const loadTeam = useCallback(async (id: string) => {
    setTeamId(id);
    setDetail(id ? await api.adminTeam(id) : null);
  }, []);

  if (!user.isAdmin) {
    return (
      <div className="page-head">
        <h1>Administración</h1>
        <p>No tienes permisos de administrador global.</p>
      </div>
    );
  }
  if (!ov) return null;

  const teamsOfLeague = detail ? ov.teams.filter((t) => t.leagueId === detail.leagueId) : [];

  return (
    <>
      <div className="page-head">
        <span className="eb">God-mode del Hub</span>
        <h1>Administración global</h1>
        <p>Correcciones quirúrgicas sobre datos, economía y puntuaciones. Cada acción queda auditada.</p>
      </div>

      {/* Hub / Datos (Inicializar y rellenar) */}
      <div className="card-head" style={{ marginBottom: 0 }}><h3>Hub de datos</h3></div>
      <div className="card">
        {hubStatus && (
          <p className="muted" style={{ fontSize: ".85rem", marginTop: 0 }}>
            Proveedor: <b>{hubStatus.provider}</b>{hubStatus.apiSeason ? ` · temporada API ${hubStatus.apiSeason}` : ""} · temporada activa: <b>{hubStatus.season ?? "—"}</b>
            {" · "}{hubStatus.teams} equipos · {hubStatus.players} jugadores · {hubStatus.coaches} DT · jornadas {hubStatus.gameweeksPlayed}/{hubStatus.gameweeks}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn-sm ghost" disabled={busy} style={{ borderColor: "#f87171", color: "#f87171" }}
            onClick={() => setResetOpen(true)}>Inicializar (borrar todo)</button>
          <button className="btn-sm" disabled={busy}
            onClick={() => run(async () => { await api.adminHubBackfill(); await loadOverview(); }, "Hub rellenado desde el proveedor")}>Rellenar desde API</button>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="number" min={1} max={5} value={playCount} className="ins-select" style={{ width: 56, margin: 0 }}
              onChange={(e) => setPlayCount(Number(e.target.value))} />
            <button className="btn-sm ghost" disabled={busy}
              onClick={() => run(async () => { const r = await api.adminHubPlay(playCount); await loadOverview(); notify(`Jugadas ${r.played.length} jornada(s)`, true); }, "Jornadas jugadas")}>Jugar jornadas</button>
          </span>
          <button className="btn-sm ghost" disabled={busy}
            onClick={() => run(async () => {
              const r = await api.adminHubSyncChanges();
              await loadOverview();
              notify(r.total === 0 ? "Sin cambios en el proveedor" : `${r.total} cambios: ${r.newPlayers} altas · ${r.clubChanges} club · ${r.positionChanges} posición · ${r.departures} bajas`, true);
            }, "Comprobación de cambios completada")}>Comprobar cambios</button>
        </div>
        <p className="muted" style={{ fontSize: ".76rem", marginTop: 10 }}>
          «Inicializar» borra equipos, jugadores, ligas fantasy y partidos (las cuentas de usuario se conservan). «Rellenar» pide los datos al proveedor activo. «Jugar jornadas» ingiere y puntúa las siguientes.
        </p>
      </div>

      {/* Selector de equipo */}
      <div className="card">
        <div className="field" style={{ marginTop: 0 }}>
          <label htmlFor="team">Equipo</label>
          <select id="team" value={teamId} onChange={(e) => void loadTeam(e.target.value)}>
            <option value="">— elige un equipo —</option>
            {ov.teams.map((t) => (
              <option key={t.id} value={t.id}>{t.league} · {t.name} ({t.manager}) — {eur(t.budget)}</option>
            ))}
          </select>
        </div>
      </div>

      {detail && (
        <>
          {/* Caja */}
          <div className="card-head" style={{ marginBottom: 0 }}><h3>{detail.name} — saldo: {eur(detail.budget)}</h3></div>
          <div className="card">
            <div className="grid g-2">
              <div className="field" style={{ marginTop: 0 }}>
                <label htmlFor="amount">Dar/quitar dinero (negativo = quitar)</label>
                <input id="amount" type="number" step={100000} value={money.amount}
                  onChange={(e) => setMoney((m) => ({ ...m, amount: Number(e.target.value) }))} />
              </div>
              <div className="field" style={{ marginTop: 0 }}>
                <label htmlFor="reason">Motivo</label>
                <input id="reason" value={money.reason} placeholder="Ajuste del administrador"
                  onChange={(e) => setMoney((m) => ({ ...m, reason: e.target.value }))} />
              </div>
            </div>
            <button className="btn" disabled={busy} onClick={() => run(async () => {
              const r = await api.adminMoney(detail.id, money.amount, money.reason || undefined);
              setDetail({ ...detail, budget: r.budget });
            }, "Saldo ajustado")}><span>Aplicar ajuste</span></button>
          </div>

          {/* Jugadores: valor/rating + reasignación */}
          <div className="card-head" style={{ marginBottom: 0 }}><h3>Plantilla</h3></div>
          <div className="card pad0">
            <table className="table">
              <thead><tr><th>Jugador</th><th>Pos</th><th style={{ textAlign: "right" }}>Rating</th><th style={{ textAlign: "right" }}>Valor</th><th>Reasignar a</th><th>Ciclo (Hub)</th></tr></thead>
              <tbody>
                {detail.players.map((p) => (
                  <PlayerRow key={p.playerId} p={p} teamsOfLeague={teamsOfLeague} leagueId={detail.leagueId}
                    busy={busy} run={run} reload={() => loadTeam(detail.id)}
                    onHub={(kind) => setHub({ playerId: p.playerId, name: p.name, kind })} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Corregir puntuación de jornada */}
          <div className="card-head" style={{ marginBottom: 0 }}><h3>Corregir puntuación de jornada</h3></div>
          <div className="card">
            <div className="grid g-2">
              <div className="field" style={{ marginTop: 0 }}>
                <label htmlFor="scoreGw">Jornada</label>
                <select id="scoreGw" value={score.gameweekId} onChange={(e) => setScore((s) => ({ ...s, gameweekId: e.target.value }))}>
                  <option value="">— jornada —</option>
                  {ov.gameweeks.map((g) => <option key={g.id} value={g.id}>J{g.number} ({g.status})</option>)}
                </select>
              </div>
              <div className="field" style={{ marginTop: 0 }}>
                <label htmlFor="points">Puntos</label>
                <input id="points" type="number" value={score.points} onChange={(e) => setScore((s) => ({ ...s, points: Number(e.target.value) }))} />
              </div>
            </div>
            <button className="btn" disabled={busy || !score.gameweekId} onClick={() => run(async () => {
              await api.adminSetScore({ fantasyTeamId: detail.id, gameweekId: score.gameweekId, points: score.points });
            }, "Puntuación fijada")}><span>Fijar puntuación</span></button>
          </div>
        </>
      )}

      {/* Recalcular jornada (global) */}
      <div className="card-head" style={{ marginBottom: 0, marginTop: 8 }}><h3>Recalcular jornada (tras corregir datos)</h3></div>
      <div className="card">
        <div className="field" style={{ marginTop: 0 }}>
          <label htmlFor="recomp">Jornada</label>
          <select id="recomp" value={recomputeGw} onChange={(e) => setRecomputeGw(e.target.value)}>
            <option value="">— jornada —</option>
            {ov.gameweeks.filter((g) => g.status === "FINISHED").map((g) => <option key={g.id} value={g.id}>J{g.number}</option>)}
          </select>
        </div>
        <button className="btn" disabled={busy || !recomputeGw} onClick={() => run(async () => {
          const r = await api.adminRecompute(recomputeGw);
          notify(`Recalculado: ${r.playersScored} jugadores, ${r.teamsScored} equipos`, true);
        }, "Jornada recalculada")}><span>Recalcular</span></button>
      </div>

      {/* Auditoría */}
      <div className="card-head" style={{ marginBottom: 0, marginTop: 8 }}>
        <h3>Auditoría</h3>
        <button className="chip" onClick={() => void loadOverview()}>Refrescar</button>
      </div>
      <div className="card pad0">
        <table className="table">
          <thead><tr><th>Cuándo</th><th>Admin</th><th>Acción</th><th>Objetivo</th></tr></thead>
          <tbody>
            {(audit ?? []).map((a) => (
              <tr key={a.id}>
                <td className="muted">{new Date(a.createdAt).toLocaleString("es-ES")}</td>
                <td>{a.admin}</td>
                <td><code>{a.action}</code></td>
                <td className="muted">{a.target ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={hub !== null}
        title={hub?.kind === "retire" ? "Retirar jugador" : "Traspaso a otra liga"}
        confirmLabel={hub?.kind === "retire" ? "Retirar" : "Traspasar fuera"}
        cancelLabel="Cancelar"
        busy={busy}
        onCancel={() => setHub(null)}
        onConfirm={() => {
          const h = hub;
          if (!h) return;
          void run(async () => {
            if (h.kind === "retire") await api.adminRetire(h.playerId);
            else await api.adminTransferOut(h.playerId);
            if (teamId) await loadTeam(teamId);
            await loadOverview();
            setHub(null);
          }, h.kind === "retire" ? "Jugador retirado" : "Jugador traspasado fuera");
        }}
      >
        {hub?.kind === "retire" ? (
          <p><b>{hub?.name}</b> se retira: desaparecerá de mercados, plantillas y alineaciones de todas las ligas, <b>sin</b> compensación a sus dueños.</p>
        ) : (
          <p><b>{hub?.name}</b> ficha por otra liga: desaparecerá de todas las ligas y cada dueño <b>cobrará su cláusula</b> como compensación.</p>
        )}
      </Modal>

      <Modal
        open={resetOpen}
        title="Inicializar el Hub"
        confirmLabel="Borrar todo"
        cancelLabel="Cancelar"
        busy={busy}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => run(async () => {
          await api.adminHubReset();
          setTeamId(""); setDetail(null);
          await loadOverview();
          setResetOpen(false);
        }, "Hub inicializado (datos borrados)")}
      >
        <p>Esto <b>borra todos los datos</b> del juego: equipos, jugadores, entrenadores, ligas fantasy, plantillas, partidos, puntuaciones y mercado. <b>Las cuentas de usuario se conservan.</b> No se puede deshacer.</p>
      </Modal>

      {toast && <div className={`toast ${toast.ok ? "ok" : "err"}`}>{toast.text}</div>}
    </>
  );
}

function PlayerRow({
  p, teamsOfLeague, leagueId, busy, run, reload, onHub,
}: {
  p: AdminTeamDetail["players"][number];
  teamsOfLeague: { id: string; name: string }[];
  leagueId: string;
  busy: boolean;
  run: (fn: () => Promise<void>, ok: string) => Promise<void>;
  reload: () => Promise<void>;
  onHub: (kind: "transferOut" | "retire") => void;
}) {
  const [rating, setRating] = useState(p.rating);
  const [value, setValue] = useState(p.value);
  const [dest, setDest] = useState("");
  const dirty = rating !== p.rating || value !== p.value;

  return (
    <tr>
      <td>{p.name}</td>
      <td>{p.position}</td>
      <td style={{ textAlign: "right" }}>
        <input type="number" value={rating} className="ins-select" style={{ width: 64, textAlign: "right", margin: 0 }}
          onChange={(e) => setRating(Number(e.target.value))} />
      </td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <input type="number" step={100000} value={value} className="ins-select" style={{ width: 110, textAlign: "right", margin: 0 }}
          onChange={(e) => setValue(Number(e.target.value))} />
        {dirty && (
          <button className="chip" style={{ marginLeft: 6 }} disabled={busy}
            onClick={() => run(async () => { await api.adminUpdatePlayer(p.playerId, { rating, value }); await reload(); }, "Jugador actualizado")}>Guardar</button>
        )}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <select value={dest} onChange={(e) => setDest(e.target.value)} className="ins-select" style={{ margin: 0, maxWidth: 150 }}>
          <option value="">—</option>
          {teamsOfLeague.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {dest && (
          <button className="chip" style={{ marginLeft: 6 }} disabled={busy}
            onClick={() => run(async () => { await api.adminReassign(leagueId, { playerId: p.playerId, toTeamId: dest }); await reload(); }, "Jugador reasignado")}>Mover</button>
        )}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <select value={p.position} className="ins-select" style={{ margin: 0, width: 66 }} disabled={busy}
          title="Cambiar posición"
          onChange={(e) => run(async () => { await api.adminChangePosition(p.playerId, e.target.value); await reload(); }, "Posición cambiada")}>
          {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
        </select>
        <button className="chip" style={{ marginLeft: 6 }} disabled={busy} title="Ficha por otra liga (compensa cláusula)" onClick={() => onHub("transferOut")}>✈️ Fuera</button>
        <button className="chip" style={{ marginLeft: 6 }} disabled={busy} title="Se retira (sin compensación)" onClick={() => onHub("retire")}>🎬 Retira</button>
      </td>
    </tr>
  );
}
