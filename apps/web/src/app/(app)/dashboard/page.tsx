"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { api, type GameweekMatch, type GameweekRow, type NewsEvent, type StandingRow } from "@/lib/api";
import { eur } from "@/lib/format";

const NEWS_ICON: Record<NewsEvent["type"], string> = {
  NEW_PLAYER: "🆕", CLUB_CHANGE: "🔄", TRANSFER_OUT: "✈️", RETIREMENT: "🎬", POSITION_CHANGE: "📐",
};
function newsText(n: NewsEvent): string {
  switch (n.type) {
    case "NEW_PLAYER": return `${n.playerName} se incorpora${n.to ? ` (${n.to})` : ""}`;
    case "CLUB_CHANGE": return `${n.playerName} ficha por ${n.to}${n.from ? ` (antes ${n.from})` : ""}`;
    case "TRANSFER_OUT": return `${n.playerName} deja la liga (fichado por otra liga)`;
    case "RETIREMENT": return `${n.playerName} se retira`;
    case "POSITION_CHANGE": return `${n.playerName} pasa a ${n.to}${n.from ? ` (antes ${n.from})` : ""}`;
    default: return n.playerName;
  }
}

export default function Dashboard() {
  const { leagueId, league, team, user, gwNumber } = useApp();
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [gameweeks, setGameweeks] = useState<GameweekRow[] | null>(null);
  const [news, setNews] = useState<NewsEvent[] | null>(null);
  const [openGw, setOpenGw] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, GameweekMatch[]>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void api.standings(leagueId).then(setStandings);
    void api.gameweeks(leagueId).then(setGameweeks);
    void api.news(leagueId).then(setNews);
  }, [leagueId]);

  async function toggleGw(id: string) {
    if (openGw === id) { setOpenGw(null); return; }
    setOpenGw(id);
    if (!matches[id]) {
      const m = await api.gameweekMatches(leagueId, id);
      setMatches((prev) => ({ ...prev, [id]: m }));
    }
  }

  function copyInvite() {
    void navigator.clipboard?.writeText(league.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const myRow = standings && team ? standings.find((r) => r.teamId === team.id) : undefined;
  const upcoming = gameweeks?.filter((g) => g.status === "UPCOMING" || g.status === "OPEN").slice(0, 5) ?? [];

  return (
    <>
      <div className="page-head">
        <span className="eb">{gwNumber ? `Jornada ${gwNumber}` : "Pretemporada"}</span>
        <h1>Hola, {user.displayName}</h1>
        <p>Esto es lo que está pasando en tu equipo. Aún puedes retocar la alineación antes del cierre.</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 12, padding: "8px 12px", border: "1px solid var(--line, #2a2733)", borderRadius: 10 }}>
          <span className="muted" style={{ fontSize: ".78rem" }}>Invita a tu liga · código</span>
          <code style={{ fontWeight: 700, letterSpacing: ".12em" }}>{league.inviteCode}</code>
          <button className="chip" onClick={copyInvite}>{copied ? "¡Copiado!" : "Copiar"}</button>
        </div>
      </div>

      <div className="grid g-4">
        <div className="tile"><span className="k">Posición</span><div className="v">{myRow ? `${myRow.rank}º` : "—"}</div><div className="d">de {standings?.length ?? "…"} en tu liga</div></div>
        <div className="tile"><span className="k">Puntos totales</span><div className="v">{myRow?.points ?? 0}</div><div className="d">{myRow?.played ?? 0} jornadas jugadas</div></div>
        <div className="tile"><span className="k">Valor plantilla</span><div className="v">{team ? eur(team.squadValue) : "—"}</div></div>
        <div className="tile"><span className="k">Saldo</span><div className="v">{team ? eur(team.budget) : "—"}</div><div className="d">para fichar</div></div>
      </div>

      <div className="grid g-3">
        <div className="card col-2 pad0">
          <div className="card-head" style={{ padding: "22px 22px 0" }}>
            <h3>Próximas jornadas</h3>
            <Link href="/alineacion">Alinear</Link>
          </div>
          <table className="table" style={{ marginTop: 10 }}>
            <tbody>
              {upcoming.map((g) => (
                <FragmentRow
                  key={g.id}
                  g={g}
                  open={openGw === g.id}
                  matches={matches[g.id]}
                  onToggle={() => toggleGw(g.id)}
                />
              ))}
              {upcoming.length === 0 && <tr><td className="muted">Temporada completa.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card pad0">
          <div className="card-head" style={{ padding: "22px 22px 0" }}><h3>Clasificación</h3><Link href="/clasificacion">Ver todo</Link></div>
          <table className="table" style={{ marginTop: 10 }}>
            <tbody>
              {standings?.slice(0, 6).map((s) => (
                <tr key={s.teamId} className={team && s.teamId === team.id ? "you" : ""}>
                  <td className="rank">{s.rank}</td>
                  <td>{s.teamName}</td>
                  <td className="num">{s.points}</td>
                </tr>
              ))}
              {!standings && <tr><td className="muted">Cargando…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card pad0">
        <div className="card-head" style={{ padding: "22px 22px 0" }}>
          <h3>Últimas noticias</h3>
          <span className="muted" style={{ fontSize: ".78rem" }}>Traspasos · jubilaciones · altas · cambios</span>
        </div>
        <div style={{ padding: "10px 22px 18px" }}>
          {news === null ? (
            <span className="muted" style={{ fontSize: ".85rem" }}>Cargando…</span>
          ) : news.length === 0 ? (
            <span className="muted" style={{ fontSize: ".85rem" }}>Sin novedades por ahora. Aquí aparecerán los movimientos del mercado real (traspasos, jubilaciones, altas y cambios de club o posición).</span>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {news.map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: ".9rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>{NEWS_ICON[n.type]}</span>
                  <span style={{ flex: 1 }}>{newsText(n)}</span>
                  <span className="muted" style={{ fontSize: ".76rem", whiteSpace: "nowrap" }}>
                    {new Date(n.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid g-3">
        <div className="card col-2">
          <div className="card-head"><h3>Tu plantilla</h3><Link href="/plantilla">Ver plantilla</Link></div>
          <div className="prow" style={{ borderBottom: "none" }}>
            <span className="nm">{team?.name}<small>{team?.squadSize} jugadores · {team ? eur(team.totalWorth) : ""} de patrimonio</small></span>
            <Link href="/alineacion" className="badge fit" style={{ marginLeft: "auto" }}>Alinear</Link>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Mercado</h3><Link href="/mercado">Ir</Link></div>
          <p className="muted" style={{ fontSize: ".85rem" }}>Ficha agentes libres, vende y usa cláusulas para reforzar tu equipo.</p>
        </div>
      </div>
    </>
  );
}

function FragmentRow({
  g, open, matches, onToggle,
}: {
  g: GameweekRow;
  open: boolean;
  matches: GameweekMatch[] | undefined;
  onToggle: () => void;
}) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer" }}>
        <td className="rank">J{g.number}</td>
        <td>{g.matches} partidos <span className="muted" style={{ fontSize: ".72rem" }}>· {open ? "ocultar" : "ver"}</span></td>
        <td className="num muted" style={{ fontSize: ".82rem" }}>{new Date(g.deadline).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={3} style={{ padding: 0 }}>
            <div style={{ padding: "4px 16px 12px" }}>
              {!matches ? (
                <span className="muted" style={{ fontSize: ".82rem" }}>Cargando partidos…</span>
              ) : matches.length === 0 ? (
                <span className="muted" style={{ fontSize: ".82rem" }}>Sin partidos programados.</span>
              ) : (
                matches.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: ".86rem" }}>
                    <span style={{ flex: 1, textAlign: "right" }}>{m.home}</span>
                    <span className="badge fit" style={{ minWidth: 44, textAlign: "center" }}>
                      {m.homeGoals != null && m.awayGoals != null ? `${m.homeGoals}-${m.awayGoals}` : "vs"}
                    </span>
                    <span style={{ flex: 1 }}>{m.away}</span>
                  </div>
                ))
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
