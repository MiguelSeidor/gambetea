"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { api, type FantasyRules, type LineupView, type PlayerPos, type RosterPlayer } from "@/lib/api";

const POS_ORDER: PlayerPos[] = ["GK", "DEF", "MID", "FWD"];
const POS_LABEL: Record<PlayerPos, string> = { GK: "Portero", DEF: "Defensas", MID: "Medios", FWD: "Delanteros" };
const Y: Record<PlayerPos, number> = { GK: 90, DEF: 70, MID: 48, FWD: 24 };

function lineXs(n: number): number[] {
  if (n <= 1) return [50];
  return Array.from({ length: n }, (_, i) => 16 + (68 * i) / (n - 1));
}

export default function Alineacion() {
  const { leagueId, team } = useApp();
  const [rules, setRules] = useState<FantasyRules | null>(null);
  const [lineup, setLineup] = useState<LineupView | null>(null);
  const [formation, setFormation] = useState<string>("4-3-3");
  const [starters, setStarters] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string>("");
  const [benchId, setBenchId] = useState<string>("");
  const [chosenCoach, setChosenCoach] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    void Promise.all([api.rules(), api.lineup(leagueId)]).then(([r, lu]) => {
      setRules(r);
      setLineup(lu);
      setFormation(lu.formation);
      setStarters(lu.starters.map((p) => p.id));
      setCaptainId(lu.captainId ?? "");
      setBenchId(lu.bench[0]?.id ?? "");
      setChosenCoach(lu.coachId ?? "");
    });
  }, [leagueId]);

  const need = useMemo((): Record<PlayerPos, number> => {
    const f = rules?.formations[formation];
    return { GK: 1, DEF: f?.DEF ?? 0, MID: f?.MID ?? 0, FWD: f?.FWD ?? 0 };
  }, [rules, formation]);

  if (!team || !rules || !lineup) return null;

  const editable = lineup.gameweek.status !== "FINISHED";
  const playerById = new Map(team.players.map((p) => [p.id, p]));
  const startersByPos = (pos: PlayerPos) => starters.filter((id) => playerById.get(id)?.position === pos);
  const countOf = (pos: PlayerPos) => startersByPos(pos).length;
  const valid = starters.length === 11 && POS_ORDER.every((p) => countOf(p) === need[p]);
  const benchOptions = team.players.filter((p) => !starters.includes(p.id));

  function autoFill(f: string) {
    const fRules = rules!.formations[f];
    const req: Record<PlayerPos, number> = { GK: 1, DEF: fRules.DEF, MID: fRules.MID, FWD: fRules.FWD };
    const picked: string[] = [];
    for (const pos of POS_ORDER) {
      picked.push(...team!.players.filter((p) => p.position === pos).slice(0, req[pos]).map((p) => p.id));
    }
    setStarters(picked);
    if (!picked.includes(captainId)) setCaptainId(picked[0] ?? "");
    const firstBench = team!.players.find((p) => !picked.includes(p.id));
    setBenchId(firstBench?.id ?? "");
  }

  function changeFormation(f: string) {
    setFormation(f);
    autoFill(f);
    setMsg(null);
  }

  function toggle(player: RosterPlayer) {
    if (!editable) return;
    setMsg(null);
    if (starters.includes(player.id)) {
      setStarters((s) => s.filter((id) => id !== player.id));
      if (captainId === player.id) setCaptainId("");
    } else if (countOf(player.position) < need[player.position]) {
      setStarters((s) => [...s, player.id]);
      if (benchId === player.id) setBenchId("");
    }
  }

  async function save() {
    if (!valid) return;
    setSaving(true);
    setMsg(null);
    try {
      const saved = await api.saveLineup(leagueId, {
        gameweekId: lineup!.gameweek.id,
        formation,
        starters,
        bench: benchId ? [benchId] : [],
        captainId: captainId || undefined,
        coachId: chosenCoach || undefined,
      });
      setLineup(saved);
      setMsg({ text: "Alineación guardada", ok: true });
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Error al guardar", ok: false });
    } finally {
      setSaving(false);
    }
  }

  const pitch = POS_ORDER.flatMap((pos) => {
    const ids = startersByPos(pos);
    const xs = lineXs(ids.length);
    return ids.map((id, i) => ({ player: playerById.get(id)!, x: xs[i], y: Y[pos], captain: id === captainId }));
  });

  return (
    <>
      <div className="page-head">
        <span className="eb">{formation.split("-").join(" · ")}</span>
        <h1>Alineación</h1>
        <p>
          Jornada {lineup.gameweek.number}. Se toma un <b>snapshot</b> el{" "}
          {new Date(lineup.gameweek.deadline).toLocaleString("es-ES", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          {" "}(30 min antes del primer partido): es lo que puntúa.
        </p>
      </div>

      <div className="grid g-3">
        <div className="col-2">
          <div className="pitch">
            <div className="mid" />
            <div className="circle" />
            {pitch.map(({ player, x, y, captain }) => (
              <div key={player.id} className={`pp${player.position === "GK" ? " gk" : ""}`} style={{ left: `${x}%`, top: `${y}%` }}>
                <span className="dot">{player.name.slice(0, 3)}</span>
                <span className="lbl">{player.name}{captain && <small>C</small>}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Formación y once</h3></div>

          {!editable && <div className="lineup-lock">Jornada finalizada: no se puede editar.</div>}

          <div className="form-tabs">
            {Object.keys(rules.formations).map((f) => (
              <button key={f} className={f === formation ? "on" : ""} disabled={!editable} onClick={() => changeFormation(f)}>{f}</button>
            ))}
          </div>

          {POS_ORDER.map((pos) => (
            <div className="xi-group" key={pos}>
              <div className="gh">
                <span className="lab">{POS_LABEL[pos]}</span>
                <span className={`cnt${countOf(pos) === need[pos] ? " full" : ""}`}>{countOf(pos)}/{need[pos]}</span>
              </div>
              <div className="chips">
                {team.players.filter((p) => p.position === pos).map((p) => (
                  <span key={p.id} className={`chip${starters.includes(p.id) ? " on" : ""}`} onClick={() => toggle(p)}
                    title={`${p.points} pts${p.injured ? " · lesionado" : ""}${p.suspended ? " · sancionado" : ""}`}>
                    {p.injured && "🩹 "}{p.suspended && "🟥 "}{p.name}<small>{p.club ?? ""} · {p.points} pts</small>
                    {captainId === p.id && <span className="cap">C</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}

          <div className="xi-group">
            <div className="gh"><span className="lab">Entrenador</span></div>
            <select className="save-bar-select" value={chosenCoach} onChange={(e) => setChosenCoach(e.target.value)} disabled={!editable} style={{ width: "100%" }}>
              <option value="">Sin entrenador</option>
              {team.coaches.map((c) => <option key={c.id} value={c.id}>{c.name}{c.club ? ` · ${c.club}` : ""}</option>)}
            </select>
          </div>

          <div className="xi-group">
            <div className="gh"><span className="lab">Banquillo (1)</span></div>
            <select value={benchId} onChange={(e) => setBenchId(e.target.value)} disabled={!editable} style={{ width: "100%" }} className="save-bar-select">
              <option value="">Sin suplente</option>
              {benchOptions.map((p) => <option key={p.id} value={p.id}>{p.position} · {p.name}</option>)}
            </select>
          </div>

          <div className="save-bar">
            <select value={captainId} onChange={(e) => setCaptainId(e.target.value)} disabled={!editable} aria-label="Capitán">
              <option value="">Sin capitán</option>
              {starters.map((id) => <option key={id} value={id}>★ {playerById.get(id)?.name}</option>)}
            </select>
            <button className="btn" onClick={save} disabled={!editable || !valid || saving}>
              <span>{saving ? "Guardando…" : "Guardar alineación"}</span>
            </button>
            {msg && <span className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</span>}
          </div>
        </div>
      </div>
    </>
  );
}
