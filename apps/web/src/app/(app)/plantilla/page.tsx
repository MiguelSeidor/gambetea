"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Modal from "@/components/Modal";
import { eur } from "@/lib/format";
import { api, POS_SHORT, type InsuranceTier, type InsuranceTierInfo, type PlayerPos, type RosterPlayer } from "@/lib/api";
import TeamCrest from "@/components/TeamCrest";

const ORDER: PlayerPos[] = ["GK", "DEF", "MID", "FWD"];
const LABEL: Record<PlayerPos, string> = { GK: "Porteros", DEF: "Defensas", MID: "Centrocampistas", FWD: "Delanteros" };
const TIERS: { value: InsuranceTier; label: string }[] = [
  { value: "BASIC", label: "Básico +1" },
  { value: "MEDIUM", label: "Medio +3" },
  { value: "ADVANCED", label: "Avanzado +5" },
];

export default function Plantilla() {
  const { leagueId, team } = useApp();
  const [insurance, setInsurance] = useState<Map<string, InsuranceTier>>(new Map());
  const [insInfo, setInsInfo] = useState<Map<InsuranceTier, InsuranceTierInfo>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ playerId: string; tier: InsuranceTier | "" } | null>(null);

  const load = useCallback(async () => {
    const [policies, rules] = await Promise.all([api.insurances(leagueId), api.rules()]);
    setInsurance(new Map(policies.map((p) => [p.playerId, p.tier])));
    setInsInfo(new Map(rules.insurance.map((i) => [i.tier, i])));
  }, [leagueId]);
  useEffect(() => { void load(); }, [load]);

  if (!team) return null;
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
        <span className="eb">{team.squadSize} jugadores · {team.coaches.length} entrenadores</span>
        <h1>Plantilla</h1>
        <p>Sin límite de fichas (pagas salario por todas). Asegura a tus jugadores: si un titular asegurado se lesiona, suma puntos extra.</p>
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
                    <small><TeamCrest teamId={p.teamId} name={p.clubName} short={p.club} /> · {eur(p.value)}</small>
                  </span>
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
