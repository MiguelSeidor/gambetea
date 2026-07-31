"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { api, type Criterion, type CriterionScope, type LeagueSettings, type PlayerCriterion } from "@/lib/api";

const SCOPE_LABEL: Record<CriterionScope, string> = {
  ALL: "General (cualquier posición)",
  GK: "Porteros",
  DEF: "Defensas",
  MID: "Medios",
  FWD: "Delanteros",
};
const SCOPE_ORDER: CriterionScope[] = ["ALL", "GK", "DEF", "MID", "FWD"];

interface FieldDef {
  key: keyof LeagueSettings;
  label: string;
  unit: "eur" | "pct" | "x";
  hint: string;
}
const FIELDS: FieldDef[] = [
  { key: "prizePerPoint", label: "Prima por punto", unit: "eur", hint: "€ por cada punto de jornada" },
  { key: "salaryRate", label: "Salario por jornada", unit: "pct", hint: "% del valor de la plantilla" },
  { key: "compensationStep", label: "Compensación por puesto", unit: "eur", hint: "(puesto − 1) × esto (catch-up)" },
  { key: "tvRights", label: "Derechos de TV", unit: "eur", hint: "ingreso único al entrar a la liga" },
  { key: "initialBudget", label: "Presupuesto inicial", unit: "eur", hint: "saldo de arranque antes del draft" },
  { key: "clauseMultiplier", label: "Multiplicador de cláusula", unit: "x", hint: "cláusula = valor × esto" },
];
const toInput = (f: FieldDef, v: number) => (f.unit === "pct" ? +(v * 100).toFixed(2) : v);
const fromInput = (f: FieldDef, v: number) => (f.unit === "pct" ? v / 100 : Math.round(v));
const unitLabel = (u: FieldDef["unit"]) => (u === "eur" ? "€" : u === "pct" ? "%" : "×");

export default function LigaConfig() {
  const { leagueId, league } = useApp();
  const isOwner = league.role === "OWNER";
  const [settings, setSettings] = useState<LeagueSettings | null>(null);
  const [form, setForm] = useState<Record<string, number>>({});
  const [crit, setCrit] = useState<Criterion[] | null>(null);
  const [pcrit, setPcrit] = useState<PlayerCriterion[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const [s, c, p] = await Promise.all([
      api.leagueSettings(leagueId),
      api.coachCriteria(leagueId),
      api.playerCriteria(leagueId),
    ]);
    setSettings(s);
    setForm(Object.fromEntries(FIELDS.map((f) => [f.key, toInput(f, s[f.key])])));
    setCrit(c);
    setPcrit(p);
  }, [leagueId]);
  useEffect(() => { void load(); }, [load]);

  function notify(text: string, ok: boolean) {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 2600);
  }

  async function saveEconomy() {
    setSaving(true);
    try {
      const dto: Partial<LeagueSettings> = {};
      for (const f of FIELDS) dto[f.key] = fromInput(f, form[f.key]);
      setSettings(await api.updateLeagueSettings(leagueId, dto));
      notify("Economía guardada", true);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", false);
    } finally { setSaving(false); }
  }

  async function saveCriteria() {
    if (!crit) return;
    setSaving(true);
    try {
      const overrides = Object.fromEntries(crit.map((c) => [c.key, { enabled: c.enabled, value: c.value }]));
      setCrit(await api.updateCoachCriteria(leagueId, overrides));
      notify("Baremo de entrenador guardado", true);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", false);
    } finally { setSaving(false); }
  }

  function setCriterion(key: string, patch: Partial<Criterion>) {
    setCrit((cs) => cs?.map((c) => (c.key === key ? { ...c, ...patch } : c)) ?? null);
  }

  async function savePlayerCriteria() {
    if (!pcrit) return;
    setSaving(true);
    try {
      const overrides = Object.fromEntries(pcrit.map((c) => [c.key, { enabled: c.enabled, value: c.value }]));
      setPcrit(await api.updatePlayerCriteria(leagueId, overrides));
      notify("Baremo de jugador guardado", true);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error", false);
    } finally { setSaving(false); }
  }

  function setPlayerCriterion(key: string, patch: Partial<PlayerCriterion>) {
    setPcrit((cs) => cs?.map((c) => (c.key === key ? { ...c, ...patch } : c)) ?? null);
  }

  if (!settings || !crit || !pcrit) return null;

  const pByScope = SCOPE_ORDER.map((scope) => ({ scope, items: pcrit.filter((c) => c.scope === scope) })).filter((g) => g.items.length);

  return (
    <>
      <div className="page-head">
        <span className="eb">{league.name}</span>
        <h1>Config de liga</h1>
        <p>{isOwner ? "Ajusta las reglas de tu liga a tu gusto. Los valores por defecto son los recomendados." : "Reglas de esta liga (solo el creador puede cambiarlas)."}</p>
      </div>

      <div className="card-head" style={{ marginBottom: 0 }}><h3>Economía</h3></div>
      <div className="grid g-2">
        {FIELDS.map((f) => (
          <div className="card" key={f.key}>
            <div className="field" style={{ marginTop: 0 }}>
              <label htmlFor={f.key}>{f.label} ({unitLabel(f.unit)})</label>
              <input id={f.key} type="number" value={form[f.key] ?? 0} disabled={!isOwner}
                step={f.unit === "pct" ? 0.1 : f.unit === "x" ? 1 : 100000}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: Number(e.target.value) }))} />
            </div>
            <p className="muted" style={{ fontSize: ".8rem", marginTop: 8 }}>{f.hint}</p>
          </div>
        ))}
      </div>
      {isOwner && (
        <div><button className="btn" onClick={saveEconomy} disabled={saving}><span>Guardar economía</span></button></div>
      )}

      <div className="card-head" style={{ marginBottom: 0, marginTop: 8 }}><h3>Baremo de entrenador</h3></div>
      <div className="card pad0">
        <table className="table">
          <thead><tr><th>Activo</th><th>Criterio</th><th style={{ textAlign: "right" }}>Puntos</th><th style={{ textAlign: "right" }}>Recomendado</th></tr></thead>
          <tbody>
            {crit.map((c) => (
              <tr key={c.key} className={c.enabled ? "" : "muted"}>
                <td>
                  <input type="checkbox" checked={c.enabled} disabled={!isOwner}
                    onChange={(e) => setCriterion(c.key, { enabled: e.target.checked })} />
                </td>
                <td>{c.label}</td>
                <td style={{ textAlign: "right" }}>
                  <input type="number" value={c.value} disabled={!isOwner || !c.enabled} step={1}
                    className="ins-select" style={{ width: 80, textAlign: "right", margin: 0 }}
                    onChange={(e) => setCriterion(c.key, { value: Number(e.target.value) })} />
                </td>
                <td className="num muted">{c.default}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isOwner && (
        <div><button className="btn" onClick={saveCriteria} disabled={saving}><span>Guardar baremo</span></button></div>
      )}

      <div className="card-head" style={{ marginBottom: 0, marginTop: 8 }}><h3>Baremo de jugador</h3></div>
      <p className="muted" style={{ fontSize: ".8rem", marginTop: -4 }}>
        Por posición. El gol suma además el tiro a puerta (7+3=10); el penalti provocado incluye la falta recibida (2+1=3);
        el penalti parado incluye la parada (8+2=10). El % de pase de medios se puntúa por bandas (valor fijo).
      </p>
      {pByScope.map((g) => (
        <div key={g.scope} style={{ marginTop: 4 }}>
          <div className="card-head" style={{ marginBottom: 0 }}><h4>{SCOPE_LABEL[g.scope]}</h4></div>
          <div className="card pad0">
            <table className="table">
              <thead><tr><th>Activo</th><th>Criterio</th><th style={{ textAlign: "right" }}>Puntos</th><th style={{ textAlign: "right" }}>Recom.</th></tr></thead>
              <tbody>
                {g.items.map((c) => (
                  <tr key={c.key} className={c.enabled ? "" : "muted"}>
                    <td>
                      <input type="checkbox" checked={c.enabled} disabled={!isOwner}
                        onChange={(e) => setPlayerCriterion(c.key, { enabled: e.target.checked })} />
                    </td>
                    <td>{c.label}</td>
                    <td style={{ textAlign: "right" }}>
                      {c.raw ? (
                        <span className="muted" title="Puntuación por bandas, valor fijo">por banda</span>
                      ) : (
                        <input type="number" value={c.value} disabled={!isOwner || !c.enabled} step={1}
                          className="ins-select" style={{ width: 80, textAlign: "right", margin: 0 }}
                          onChange={(e) => setPlayerCriterion(c.key, { value: Number(e.target.value) })} />
                      )}
                    </td>
                    <td className="num muted">{c.raw ? "—" : c.default}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {isOwner && (
        <div><button className="btn" onClick={savePlayerCriteria} disabled={saving}><span>Guardar baremo de jugador</span></button></div>
      )}

      {toast && <div className={`toast ${toast.ok ? "ok" : "err"}`}>{toast.text}</div>}
    </>
  );
}
