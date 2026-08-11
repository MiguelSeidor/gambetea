"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Modal from "@/components/Modal";
import { eur } from "@/lib/format";
import { api, POS_SHORT, type InsuranceTier, type InsuranceTierInfo, type PlayerPos, type RosterPlayer, type Shield } from "@/lib/api";
import TeamCrest from "@/components/TeamCrest";

const ORDER: PlayerPos[] = ["GK", "DEF", "MID", "FWD"];
const LABEL: Record<PlayerPos, string> = { GK: "Porteros", DEF: "Defensas", MID: "Centrocampistas", FWD: "Delanteros" };
const TIERS: { value: InsuranceTier; label: string }[] = [
  { value: "BASIC", label: "Básico +1" },
  { value: "MEDIUM", label: "Medio +3" },
  { value: "ADVANCED", label: "Avanzado +5" },
];

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });

export default function Plantilla() {
  const { leagueId, team, refresh } = useApp();
  const [insurance, setInsurance] = useState<Map<string, InsuranceTier>>(new Map());
  const [insInfo, setInsInfo] = useState<Map<InsuranceTier, InsuranceTierInfo>>(new Map());
  const [shields, setShields] = useState<Map<string, Shield>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ playerId: string; tier: InsuranceTier | "" } | null>(null);

  const load = useCallback(async () => {
    const [policies, rules, sh] = await Promise.all([api.insurances(leagueId), api.rules(), api.shields(leagueId)]);
    setInsurance(new Map(policies.map((p) => [p.playerId, p.tier])));
    setInsInfo(new Map(rules.insurance.map((i) => [i.tier, i])));
    setShields(new Map(sh.map((s) => [s.playerId, s])));
  }, [leagueId]);
  useEffect(() => { void load(); }, [load]);

  if (!team) return null;
  const shieldCount = [...shields.values()].length;

  async function toggleShield(p: RosterPlayer) {
    const has = shields.has(p.id);
    if (has) {
      if (!window.confirm(`¿Quitar el blindaje de ${p.name}? Dejará de renovarse y caducará en su fecha de fin.`)) return;
    } else {
      if (shieldCount >= 3) { window.alert("Ya tienes 3 blindajes activos. Quita uno para blindar otro."); return; }
      if (!window.confirm(`Blindar a ${p.name} cuesta ${eur(p.value)} por semana (su valor de mercado) y se renueva solo hasta que lo quites. ¿Continuar?`)) return;
    }
    setBusy(p.id);
    try {
      if (has) await api.removeShield(leagueId, p.id);
      else await api.shieldPlayer(leagueId, p.id);
      await Promise.all([load(), refresh()]);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo actualizar el blindaje");
    } finally {
      setBusy(null);
    }
  }
  const byPos = (pos: PlayerPos): RosterPlayer[] => team.players.filter((p) => p.position === pos);

  // El select es controlado por `insurance`; no cambia hasta confirmar, así que cancelar no
  // requiere revertir nada visualmente.
  function requestTier(playerId: string, tier: InsuranceTier | "") {
    if ((insurance.get(playerId) ?? "") === tier) return;
    setPending({ playerId, tier });
  }

  async function confirmPending() {
    if (!pending) return;
    const { playerId, tier } = pending;
    setBusy(playerId);
    try {
      if (tier === "") await api.cancelInsurance(leagueId, playerId);
      else await api.insurePlayer(leagueId, playerId, tier);
      await load();
    } finally {
      setBusy(null);
      setPending(null);
    }
  }

  const pendingPlayer = pending ? team?.players.find((p) => p.id === pending.playerId) : undefined;
  const pendingTierLabel = pending && pending.tier !== "" ? TIERS.find((t) => t.value === pending.tier)?.label : null;

  return (
    <>
      <div className="page-head">
        <span className="eb">{team.squadSize} jugadores · {team.coaches.length} entrenadores · 🛡 {shieldCount}/3 blindajes</span>
        <h1>Plantilla</h1>
        <p>Sin límite de fichas (pagas salario por todas). <b>Asegura</b> a tus jugadores (bonus si un titular se lesiona) o <b>blíndalos</b> 🛡 para que nadie pueda pagar su cláusula (cuesta su valor de mercado por semana; máx. 3).</p>
      </div>

      <div className="grid g-4">
        <div className="tile"><span className="k">Saldo</span><div className="v">{eur(team.budget)}</div><div className="d">para fichar</div></div>
        <div className="tile"><span className="k">Valor plantilla</span><div className="v">{eur(team.squadValue)}</div></div>
        <div className="tile"><span className="k">Patrimonio</span><div className="v">{eur(team.totalWorth)}</div><div className="d">saldo + plantilla</div></div>
        <div className="tile"><span className="k">Fichas</span><div className="v">{team.squadSize + team.coaches.length}</div><div className="d">pagas salario</div></div>
      </div>

      <div className="grid g-2">
        {ORDER.map((pos) => {
          const players = byPos(pos);
          return (
            <div className="card" key={pos}>
              <div className="card-head">
                <h3>{LABEL[pos]}</h3>
                <span className="muted" style={{ fontSize: ".82rem" }}>{players.length}</span>
              </div>
              {players.map((p) => (
                <div className="prow" key={p.id}>
                  <span className={`pos ${p.position}`}>{POS_SHORT[p.position]}</span>
                  <span className="nm" style={{ flex: 1, minWidth: 0 }}>
                    {p.name}
                    {p.injured && <span title="Lesionado" style={{ marginLeft: 6 }}>🩹</span>}
                    {p.suspended && <span title="Sancionado" style={{ marginLeft: 4 }}>🟥</span>}
                    <small>
                      <TeamCrest teamId={p.teamId} name={p.clubName} short={p.club} /> · {eur(p.value)}
                      {shields.get(p.id) && (
                        <span style={{ color: "#a78bfa", marginLeft: 6 }} title={shields.get(p.id)!.autoRenew ? "Blindado (se renueva solo)" : "Blindaje sin renovar: caduca en la fecha indicada"}>
                          🛡 {fmtDay(shields.get(p.id)!.expiresAt)}{!shields.get(p.id)!.autoRenew && " · fin"}
                        </span>
                      )}
                    </small>
                  </span>
                  <button
                    className="chip"
                    style={{ flex: "0 0 auto", ...(shields.has(p.id) ? { borderColor: "#a78bfa", color: "#a78bfa" } : {}) }}
                    disabled={busy === p.id}
                    title={shields.has(p.id) ? "Quitar blindaje" : `Blindar (${eur(p.value)}/semana)`}
                    onClick={() => void toggleShield(p)}
                  >
                    🛡{shields.has(p.id) ? "✓" : ""}
                  </button>
                  <span className="pts-col">{p.points}<small>pts</small></span>
                  <select
                    style={{ marginLeft: 0 }}
                    className="ins-select"
                    value={insurance.get(p.id) ?? ""}
                    disabled={busy === p.id}
                    onChange={(e) => requestTier(p.id, e.target.value as InsuranceTier | "")}
                    aria-label={`Seguro de ${p.name}`}
                  >
                    <option value="">Sin seguro</option>
                    {TIERS.map((t) => {
                      const info = insInfo.get(t.value);
                      return (
                        <option key={t.value} value={t.value}>
                          {t.label}{info ? ` · ${eur(info.perGameweek)}/jornada` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ))}
              {players.length === 0 && <p className="muted" style={{ fontSize: ".85rem" }}>Sin jugadores.</p>}
            </div>
          );
        })}

        <div className="card">
          <div className="card-head">
            <h3>Entrenadores</h3>
            <span className="muted" style={{ fontSize: ".82rem" }}>{team.coaches.length}</span>
          </div>
          {team.coaches.map((c) => (
            <div className="prow" key={c.id}>
              <span className="pos DT">ENT</span>
              <span className="nm" style={{ flex: 1, minWidth: 0 }}>{c.name}<small><TeamCrest teamId={c.teamId} name={c.clubName} short={c.club} /> · {eur(c.value)}</small></span>
              <span className="pts-col">{c.points}<small>pts</small></span>
            </div>
          ))}
          {team.coaches.length === 0 && <p className="muted" style={{ fontSize: ".85rem" }}>Sin entrenadores.</p>}
        </div>
      </div>

      <Modal
        open={pending !== null}
        title={pending?.tier === "" ? "Cancelar seguro médico" : "Contratar seguro médico"}
        confirmLabel={pending?.tier === "" ? "Cancelar seguro" : "Contratar"}
        cancelLabel="Volver"
        busy={busy !== null}
        onCancel={() => setPending(null)}
        onConfirm={confirmPending}
      >
        {pending?.tier === "" ? (
          <p>¿Seguro que quieres <b>cancelar</b> el seguro médico de <b>{pendingPlayer?.name}</b>? Dejará de sumar bonus si se lesiona.</p>
        ) : (
          <p>
            Vas a contratar el seguro <b>«{pendingTierLabel}»</b> para <b>{pendingPlayer?.name}</b>.
            {pending && insInfo.get(pending.tier) && (
              <> Coste: <b>{eur(insInfo.get(pending.tier)!.perGameweek)}/jornada</b> ({eur(insInfo.get(pending.tier)!.annualCost)} anual, prorrateado).</>
            )}
            {" "}Es <b>contractual</b>: se pierde si vendes o traspasas al jugador.
          </p>
        )}
      </Modal>
    </>
  );
}
