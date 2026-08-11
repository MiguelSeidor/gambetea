"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { api, TX_LABEL, type Loan, type TransactionRow } from "@/lib/api";
import { eur } from "@/lib/format";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Finanzas() {
  const { leagueId, team, refresh } = useApp();
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [txs, setTxs] = useState<TransactionRow[] | null>(null);
  const [amount, setAmount] = useState<number>(10_000_000);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const [ln, tx] = await Promise.all([api.loans(leagueId), api.transactions(leagueId)]);
    setLoans(ln);
    setTxs(tx);
  }, [leagueId]);
  useEffect(() => { void load(); }, [load]);

  if (!team) return null;
  const maxLoan = Math.floor(team.totalWorth * 0.5);
  const active = loans?.filter((l) => l.status === "ACTIVE") ?? [];

  function notify(text: string, ok: boolean) {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 2800);
  }

  async function take() {
    setBusy(true);
    try {
      const r = await api.takeLoan(leagueId, amount);
      await Promise.all([refresh(), load()]);
      notify(`Préstamo concedido · cuota ${eur(r.installment)} × ${r.installments} jornadas`, true);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <span className="eb">Finanzas</span>
        <h1>Finanzas</h1>
        <p>Pide crédito al banco para reforzar tu equipo. Se devuelve en cuotas por jornada (amortización francesa al 5% TAE).</p>
      </div>

      <div className="grid g-4">
        <div className="tile"><span className="k">Saldo</span><div className="v">{eur(team.budget)}</div><div className={`d ${team.budget < 0 ? "down" : ""}`}>{team.budget < 0 ? "en números rojos" : "disponible"}</div></div>
        <div className="tile"><span className="k">Patrimonio</span><div className="v">{eur(team.totalWorth)}</div><div className="d">saldo + plantilla</div></div>
        <div className="tile"><span className="k">Máx. prestable</span><div className="v">{eur(maxLoan)}</div><div className="d">50% del patrimonio</div></div>
        <div className="tile"><span className="k">Préstamos</span><div className="v">{active.length}/3</div><div className="d">activos</div></div>
      </div>

      <div className="grid g-3">
        <div className="card">
          <div className="card-head"><h3>Pedir préstamo</h3></div>
          <div className="field">
            <label htmlFor="amt">Importe (€)</label>
            <input id="amt" type="number" min={1_000_000} max={maxLoan} step={1_000_000}
              value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <p className="muted" style={{ fontSize: ".78rem", marginTop: 6 }}>
              Máximo prestable: <b>{eur(maxLoan)}</b> (50% de tu patrimonio, {eur(team.totalWorth)}).
            </p>
          </div>
          <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
            disabled={busy || active.length >= 3 || amount <= 0 || amount > maxLoan}
            onClick={take}>
            <span>{busy ? "…" : active.length >= 3 ? "Máximo 3 préstamos" : "Pedir préstamo"}</span>
          </button>
          {amount > maxLoan && <p style={{ color: "#f87171", fontSize: ".8rem", marginTop: 8 }}>Supera el máximo prestable ({eur(maxLoan)}).</p>}
        </div>

        <div className="card col-2 pad0">
          <div className="card-head" style={{ padding: "22px 22px 0" }}><h3>Tus préstamos</h3></div>
          <table className="table" style={{ marginTop: 10 }}>
            <thead>
              <tr><th>Principal</th><th style={{ textAlign: "right" }}>Cuota/jornada</th><th style={{ textAlign: "right" }}>Pendiente</th><th style={{ textAlign: "right" }}>Cuotas</th><th style={{ textAlign: "right" }}>Estado</th></tr>
            </thead>
            <tbody>
              {!loans && <tr><td colSpan={5} className="muted">Cargando…</td></tr>}
              {loans?.length === 0 && <tr><td colSpan={5} className="muted">Sin préstamos.</td></tr>}
              {loans?.map((l) => (
                <tr key={l.id}>
                  <td>{eur(l.principal)}</td>
                  <td className="num">{eur(l.installment)}</td>
                  <td className="num">{eur(l.outstanding)}</td>
                  <td className="num">{l.paid}/{l.total}</td>
                  <td className="num"><span className={`badge ${l.status === "PAID" ? "fit" : ""}`}>{l.status === "PAID" ? "Pagado" : "Activo"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card pad0">
        <div className="card-head" style={{ padding: "22px 22px 0" }}>
          <h3>Últimos movimientos</h3>
          <span className="muted" style={{ fontSize: ".82rem" }}>primas, salarios, seguros, fichajes…</span>
        </div>
        <table className="table" style={{ marginTop: 10 }}>
          <thead>
            <tr><th>Concepto</th><th>Detalle</th><th>Fecha</th><th style={{ textAlign: "right" }}>Importe</th></tr>
          </thead>
          <tbody>
            {!txs && <tr><td colSpan={4} className="muted">Cargando…</td></tr>}
            {txs?.length === 0 && <tr><td colSpan={4} className="muted">Sin movimientos todavía.</td></tr>}
            {txs?.map((t) => (
              <tr key={t.id}>
                <td><span className="badge">{TX_LABEL[t.type] ?? t.type}</span></td>
                <td className="muted" style={{ fontSize: ".85rem" }}>{t.description ?? "—"}</td>
                <td className="muted" style={{ fontSize: ".82rem", whiteSpace: "nowrap" }}>{fmtDate(t.createdAt)}</td>
                <td className="num" style={{ color: t.amount >= 0 ? "#4ade80" : "#f87171", whiteSpace: "nowrap" }}>
                  {t.amount >= 0 ? "+" : "−"}{eur(Math.abs(t.amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <div className={`toast ${toast.ok ? "ok" : "err"}`}>{toast.text}</div>}
    </>
  );
}
