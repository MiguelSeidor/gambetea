"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { api, POS_SHORT, TX_LABEL, type LeaguePlayer, type MarketListing, type PlayerPos, type TransactionRow } from "@/lib/api";
import TeamCrest from "@/components/TeamCrest";
import { eur } from "@/lib/format";

type Tab = "free" | "league" | "activity";
type PosFilter = PlayerPos | "ALL" | "DT";
const POS_FREE: PosFilter[] = ["ALL", "GK", "DEF", "MID", "FWD", "DT"];
const POS_LEAGUE: PosFilter[] = ["ALL", "GK", "DEF", "MID", "FWD"];
const POS_LABEL: Record<string, string> = { ALL: "Todas", GK: "POR", DEF: "DEF", MID: "CEN", FWD: "DEL", DT: "ENT (entrenadores)" };

const Status = ({ p }: { p: { injured: boolean; suspended: boolean } }) => (
  <>
    {p.injured && <span title="Lesionado" style={{ marginLeft: 4 }}>🩹</span>}
    {p.suspended && <span title="Sancionado" style={{ marginLeft: 2 }}>🟥</span>}
  </>
);

export default function Mercado() {
  const { leagueId, team, refresh } = useApp();
  const [tab, setTab] = useState<Tab>("free");
  const [listings, setListings] = useState<MarketListing[] | null>(null);
  const [players, setPlayers] = useState<LeaguePlayer[] | null>(null);
  const [txs, setTxs] = useState<TransactionRow[] | null>(null);
  const [bids, setBids] = useState<Record<string, number>>({});
  const [listPrice, setListPrice] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  // Filtros
  const [posF, setPosF] = useState<PosFilter>("ALL");
  const [ownerF, setOwnerF] = useState<string>("ALL");
  const [transferF, setTransferF] = useState<boolean>(false);
  // "DT" solo aplica a agentes libres; al ir a jugadores de la liga se ignora.
  useEffect(() => { if (tab === "league" && posF === "DT") setPosF("ALL"); }, [tab, posF]);

  const notify = useCallback((text: string, ok: boolean) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const loadTab = useCallback(async () => {
    if (tab === "free") setListings(await api.market(leagueId));
    else if (tab === "league") setPlayers(await api.leaguePlayers(leagueId));
    else setTxs(await api.transactions(leagueId));
  }, [tab, leagueId]);

  useEffect(() => { void loadTab(); }, [loadTab]);

  async function act(key: string, fn: () => Promise<string>) {
    setBusy(key);
    try {
      const msg = await fn();
      await Promise.all([refresh(), loadTab()]);
      notify(msg, true);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", false);
    } finally {
      setBusy(null);
    }
  }

  const budget = team?.budget ?? 0;

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    (players ?? []).forEach((p) => map.set(p.ownerTeamId, p.mine ? "Tú" : p.ownerTeamName));
    return [...map.entries()];
  }, [players]);

  const filteredListings = (listings ?? []).filter((l) => {
    if (posF === "ALL") return true;
    if (posF === "DT") return l.kind === "COACH";
    return l.kind === "PLAYER" && l.asset.position === posF;
  });
  const filteredPlayers = (players ?? []).filter((p) =>
    (posF === "ALL" || posF === "DT" || p.position === posF) &&
    (ownerF === "ALL" || p.ownerTeamId === ownerF) &&
    (!transferF || p.listed),
  );

  return (
    <>
      <div className="page-head">
        <span className="eb">Saldo · {eur(budget)}</span>
        <h1>Mercado</h1>
        <p>Puja por agentes libres, pon a los tuyos en venta para especular o llévate a un rival por su cláusula.</p>
      </div>

      <div className="dev-tools">
        <span className="dl">Simulación diaria (dev)</span>
        <span className="muted" style={{ fontSize: ".78rem" }}>En producción esto ocurre solo a las 06:00 (jornada, valores, clasificación y mercado). No aparecerá en la app final.</span>
        <button className="btn-sm ghost" disabled={busy !== null}
          onClick={() => act("tick", async () => {
            const gw = (await api.tick()).competitions[0]?.settledGameweek;
            return `Día avanzado${gw ? ` · jornada ${gw}` : ""}`;
          })}>Avanzar día</button>
      </div>

      <div className="form-tabs" style={{ marginTop: 4 }}>
        <button className={tab === "free" ? "on" : ""} onClick={() => setTab("free")}>Agentes libres</button>
        <button className={tab === "league" ? "on" : ""} onClick={() => setTab("league")}>Jugadores de la liga</button>
        <button className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>Mi actividad</button>
      </div>

      {/* Filtros */}
      {(tab === "free" || tab === "league") && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", margin: "4px 0 10px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".82rem" }}>
            <span className="muted">Posición</span>
            <select className="ins-select" style={{ margin: 0 }} value={posF} onChange={(e) => setPosF(e.target.value as PosFilter)}>
              {(tab === "free" ? POS_FREE : POS_LEAGUE).map((p) => <option key={p} value={p}>{POS_LABEL[p]}</option>)}
            </select>
          </label>
          {tab === "league" && (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".82rem" }}>
                <span className="muted">Propietario</span>
                <select className="ins-select" style={{ margin: 0 }} value={ownerF} onChange={(e) => setOwnerF(e.target.value)}>
                  <option value="ALL">Todos</option>
                  {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".82rem" }}>
                <input type="checkbox" checked={transferF} onChange={(e) => setTransferF(e.target.checked)} />
                <span className="muted">Solo transferibles</span>
              </label>
            </>
          )}
        </div>
      )}

      {tab === "free" && (
        listings === null ? <p className="muted">Cargando…</p> :
        filteredListings.length === 0 ? <div className="card"><p className="muted">No hay agentes libres con ese filtro.</p></div> :
        <div className="grid g-3">
          {filteredListings.map((l) => {
            const amount = bids[l.listingId] ?? l.askingPrice;
            const isCoach = l.kind === "COACH";
            return (
              <div className="card" key={l.listingId}>
                <div className="card-head">
                  <span className={`pos ${isCoach ? "DT" : l.asset.position}`}>{isCoach || !l.asset.position ? "ENT" : POS_SHORT[l.asset.position]}</span>
                  <span className="badge fit">{isCoach ? "Entrenador" : "Libre"}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{l.asset.name}<Status p={l.asset} /></div>
                <div className="muted" style={{ fontSize: ".82rem", display: "flex", alignItems: "center", gap: 6 }}><TeamCrest teamId={l.asset.teamId} name={l.asset.clubName} short={l.asset.club} size={20} />{l.asset.clubName ?? l.asset.club ?? "—"}</div>
                <div className="mkt-meta">
                  <div className="m"><div className="l">Valor</div><div className="val">{eur(l.asset.value)}</div></div>
                  <div className="m"><div className="l">Puntos</div><div className="val">{l.asset.points}</div></div>
                  <div className="m"><div className="l">Salida</div><div className="val">{eur(l.askingPrice)}</div></div>
                </div>
                {l.myBid != null && <div className="muted" style={{ fontSize: ".8rem", marginBottom: 8 }}>Tu puja: <b style={{ color: "var(--accent)" }}>{eur(l.myBid)}</b></div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="mkt-input" type="number" min={l.askingPrice} step={100000} value={amount}
                    onChange={(e) => setBids((b) => ({ ...b, [l.listingId]: Number(e.target.value) }))} style={{ flex: 1 }} />
                  <button className="btn-sm" disabled={busy !== null || amount > budget}
                    onClick={() => act(`bid-${l.listingId}`, async () => { await api.placeBid(leagueId, l.listingId, amount); return "Puja registrada"; })}>
                    {l.myBid != null ? "Mejorar" : "Pujar"}
                  </button>
                </div>
                {amount > budget && <div style={{ color: "#f87171", fontSize: ".76rem", marginTop: 6 }}>Supera tu saldo</div>}
              </div>
            );
          })}
        </div>
      )}

      {tab === "league" && (
        players === null ? <p className="muted">Cargando…</p> :
        <div className="card pad0">
          <table className="table">
            <thead><tr><th>Pos</th><th>Jugador</th><th>Propietario</th><th style={{ textAlign: "right" }}>Pts</th><th style={{ textAlign: "right" }}>Valor</th><th style={{ textAlign: "right" }}>Cláusula</th><th></th></tr></thead>
            <tbody>
              {filteredPlayers.map((p) => (
                <tr key={p.playerId} className={p.mine ? "you" : ""}>
                  <td><span className={`pos ${p.position}`}>{POS_SHORT[p.position]}</span></td>
                  <td><strong>{p.name}</strong><Status p={p} /> <span className="muted" style={{ fontSize: ".8rem" }}>· <TeamCrest teamId={p.teamId} name={p.clubName} short={p.club} /></span>
                    {p.listed && <span className="badge fit" style={{ marginLeft: 6 }}>En venta {p.askingPrice != null ? eur(p.askingPrice) : ""}</span>}
                  </td>
                  <td className="muted">{p.mine ? "Tú" : p.ownerTeamName}</td>
                  <td className="num">{p.points}</td>
                  <td className="num">{eur(p.value)}</td>
                  <td className="num">{eur(p.clause)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {p.mine ? (
                      <MineActions p={p} busy={busy !== null} price={listPrice[p.playerId] ?? p.value}
                        setPrice={(v) => setListPrice((s) => ({ ...s, [p.playerId]: v }))}
                        onList={() => act(`list-${p.playerId}`, async () => { await api.listPlayer(leagueId, p.playerId, listPrice[p.playerId] ?? p.value); return `${p.name} en venta`; })}
                        onUnlist={() => act(`unlist-${p.playerId}`, async () => { await api.unlistPlayer(leagueId, p.playerId); return `${p.name} retirado de la venta`; })}
                        onSell={() => act(`sell-${p.playerId}`, async () => `Vendido por ${eur((await api.sellPlayer(leagueId, p.playerId)).price)}`)} />
                    ) : p.listed && p.listingId ? (
                      <BidTransfer p={p} busy={busy !== null} budget={budget}
                        onBid={(amt) => act(`tbid-${p.playerId}`, async () => { await api.placeBid(leagueId, p.listingId!, amt); return "Puja registrada"; })} />
                    ) : (
                      <button className="btn-sm" disabled={busy !== null || p.clause > budget}
                        onClick={() => act(`cl-${p.playerId}`, async () => { await api.payClause(leagueId, p.playerId); return `${p.name} es tuyo`; })}>Cláusula</button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredPlayers.length === 0 && <tr><td colSpan={7} className="muted">Sin jugadores con ese filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "activity" && (
        txs === null ? <p className="muted">Cargando…</p> :
        txs.length === 0 ? <div className="card"><p className="muted">Sin movimientos todavía.</p></div> :
        <div className="card pad0">
          <table className="table">
            <thead><tr><th>Concepto</th><th>Detalle</th><th style={{ textAlign: "right" }}>Importe</th><th style={{ textAlign: "right" }}>Fecha</th></tr></thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id}>
                  <td><span className="badge">{TX_LABEL[t.type] ?? t.type}</span></td>
                  <td>{t.description ?? "—"}</td>
                  <td className="num" style={{ color: t.amount < 0 ? "#f87171" : "#4ade80" }}>{t.amount < 0 ? "" : "+"}{eur(t.amount)}</td>
                  <td className="num muted" style={{ fontSize: ".8rem" }}>{new Date(t.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <div className={`toast ${toast.ok ? "ok" : "err"}`}>{toast.text}</div>}
    </>
  );
}

function MineActions({ p, busy, price, setPrice, onList, onUnlist, onSell }: {
  p: LeaguePlayer; busy: boolean; price: number; setPrice: (v: number) => void;
  onList: () => void; onUnlist: () => void; onSell: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (p.listed) {
    return <button className="btn-sm ghost" disabled={busy} onClick={onUnlist}>Quitar venta</button>;
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      {open ? (
        <>
          <input type="number" step={100000} value={price} className="ins-select" style={{ width: 110, textAlign: "right", margin: 0 }}
            onChange={(e) => setPrice(Number(e.target.value))} />
          <button className="btn-sm" disabled={busy} onClick={onList}>En venta</button>
        </>
      ) : (
        <button className="btn-sm ghost" disabled={busy} onClick={() => setOpen(true)}>Poner en venta</button>
      )}
      <button className="btn-sm ghost" disabled={busy} onClick={onSell}>Vender al banco</button>
    </span>
  );
}

function BidTransfer({ p, busy, budget, onBid }: { p: LeaguePlayer; busy: boolean; budget: number; onBid: (amt: number) => void }) {
  const [amt, setAmt] = useState<number>(p.myBid ?? p.askingPrice ?? p.value);
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input type="number" step={100000} value={amt} className="ins-select" style={{ width: 120, textAlign: "right", margin: 0 }}
        onChange={(e) => setAmt(Number(e.target.value))} />
      <button className="btn-sm" disabled={busy || amt > budget || amt < (p.askingPrice ?? 0)}
        onClick={() => onBid(amt)}>{p.myBid != null ? "Mejorar" : "Pujar"}</button>
    </span>
  );
}
