"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import {
  api,
  type Criterion,
  type CriterionScope,
  type FantasyRules,
  type LeagueSettings,
  type PlayerCriterion,
  type StadiumView,
} from "@/lib/api";
import { eur } from "@/lib/format";

const SCOPE_LABEL: Record<CriterionScope, string> = {
  ALL: "General (cualquier posición)",
  GK: "Porteros",
  DEF: "Defensas",
  MID: "Medios",
  FWD: "Delanteros",
};
const SCOPE_ORDER: CriterionScope[] = ["ALL", "GK", "DEF", "MID", "FWD"];
const SECTIONS = [
  ["liga", "Liga y equipo"],
  ["plantilla", "Plantilla y salarios"],
  ["alineacion", "Alineación"],
  ["ciclo", "Ciclo de la jornada"],
  ["jugadores", "Puntos de jugador"],
  ["entrenadores", "Puntos de entrenador"],
  ["economia", "Economía y primas"],
  ["mercado", "Mercado y traspasos"],
  ["prestamos", "Préstamos"],
  ["seguros", "Seguro médico"],
  ["estadio", "Estadio"],
  ["rojos", "Números rojos"],
] as const;

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function Reglas() {
  const { leagueId } = useApp();
  const [settings, setSettings] = useState<LeagueSettings | null>(null);
  const [coach, setCoach] = useState<Criterion[] | null>(null);
  const [player, setPlayer] = useState<PlayerCriterion[] | null>(null);
  const [stadium, setStadium] = useState<StadiumView | null>(null);
  const [rules, setRules] = useState<FantasyRules | null>(null);

  const load = useCallback(async () => {
    const [s, c, p, st, r] = await Promise.all([
      api.leagueSettings(leagueId),
      api.coachCriteria(leagueId),
      api.playerCriteria(leagueId),
      api.stadium(leagueId),
      api.rules(),
    ]);
    setSettings(s); setCoach(c); setPlayer(p); setStadium(st); setRules(r);
  }, [leagueId]);
  useEffect(() => { void load(); }, [load]);

  if (!settings || !coach || !player || !stadium || !rules) return null;

  const salaryPct = +(settings.salaryRate * 100).toFixed(2);
  const playerByScope = SCOPE_ORDER
    .map((scope) => ({ scope, items: player.filter((c) => c.scope === scope && c.enabled) }))
    .filter((g) => g.items.length);
  const coachOn = coach.filter((c) => c.enabled);
  const formations = Object.keys(rules.formations);

  return (
    <>
      <div className="page-head">
        <span className="eb">Todo lo que hay que saber</span>
        <h1>Reglas del juego</h1>
        <p>
          Estas son las reglas <b>de esta liga</b> con su configuración actual. Los baremos y la economía
          son ajustables por el creador en <Link href="/liga">Config liga</Link>.
        </p>
      </div>

      {/* Índice */}
      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="badge fit" style={{ textDecoration: "none" }}>{label}</a>
        ))}
      </div>

      {/* 1. Liga y equipo */}
      <Section id="liga" title="1 · Liga y equipo">
        <ul className="rules-list">
          <li>Te registras y creas o te unes a una <b>liga privada</b> con un código de 6 caracteres (lo tienes en el Dashboard).</li>
          <li>Al entrar recibes un <b>equipo</b> con un <b>draft inicial</b> de {rules.squadSize} jugadores
            ({rules.composition.GK} POR, {rules.composition.DEF} DEF, {rules.composition.MID} MED, {rules.composition.FWD} DEL) + 1 entrenador.</li>
          <li><b>Presupuesto inicial:</b> {eur(settings.initialBudget)} menos el valor de lo drafteado, más <b>Derechos de TV</b> ({eur(settings.tvRights)}) al arrancar la temporada.</li>
          <li>Puedes estar en <b>varias ligas</b>; cada una tiene su equipo, saldo y clasificación.</li>
        </ul>
      </Section>

      {/* 2. Plantilla y salarios */}
      <Section id="plantilla" title="2 · Plantilla y salarios">
        <ul className="rules-list">
          <li><b>Sin límite</b> de jugadores ni entrenadores.</li>
          <li><b>Contrapeso:</b> cada jornada pagas <b>salario</b> = <b>{salaryPct}% del valor</b> de cada ficha (jugadores + entrenadores). Plantilla ancha o cara sin rendimiento → los salarios te comen.</li>
          <li>El valor de cada activo se <b>recalcula tras cada jornada</b> (ver Economía).</li>
        </ul>
      </Section>

      {/* 3. Alineación */}
      <Section id="alineacion" title="3 · Alineación">
        <ul className="rules-list">
          <li><b>11 titulares</b> según la formación elegida: {formations.join(" · ")} (siempre 1 portero).</li>
          <li><b>+ 1 entrenador</b> de tu plantilla: <b>solo ese</b> puntúa. <b>+ 1 suplente</b> en el banquillo.</li>
          <li><b>Capitán</b> (opcional): un titular que <b>dobla</b> sus puntos si juega.</li>
          <li><b>Sustitución automática:</b> un titular que no juega (0 min) es sustituido por el suplente si es de su <b>misma posición</b> y sí jugó.</li>
          <li>Puedes editar hasta el cierre, pero lo que cuenta es el <b>snapshot</b> (ver Ciclo).</li>
        </ul>
      </Section>

      {/* 4. Ciclo */}
      <Section id="ciclo" title="4 · Ciclo de la jornada">
        <div className="card pad0">
          <table className="table">
            <thead><tr><th>Momento</th><th>Qué ocurre</th></tr></thead>
            <tbody>
              <tr><td><b>−30 min</b> (1er partido)</td><td><b>Snapshot</b>: se congela tu alineación y tu caja. Es lo que puntúa.</td></tr>
              <tr><td><b>+30 min</b> (último partido)</td><td>Se calculan <b>puntos</b> y se reparten las <b>primas</b> (a todos).</td></tr>
              <tr><td><b>00:00</b> (día de jornada)</td><td>Se cobran <b>salarios</b>, <b>seguro</b> y <b>cuotas de préstamo</b>.</td></tr>
              <tr><td><b>00:00</b> (mercado)</td><td>Se resuelven <b>pujas</b>, se <b>revalorizan</b> los activos y <b>rota</b> el mercado.</td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* 5. Puntos de jugador (baremo real de la liga) */}
      <Section id="jugadores" title="5 · Puntos de jugador">
        <p className="muted" style={{ fontSize: ".86rem", marginTop: -4 }}>
          Baremo activo en esta liga. El gol suma además el tiro a puerta; el penalti provocado incluye la falta recibida; el penalti parado incluye la parada.
        </p>
        <div className="grid g-2">
          {playerByScope.map((g) => (
            <div className="card pad0" key={g.scope}>
              <div className="card-head" style={{ padding: "16px 18px 0" }}><h3 style={{ fontSize: "1rem" }}>{SCOPE_LABEL[g.scope]}</h3></div>
              <table className="table" style={{ marginTop: 8 }}>
                <tbody>
                  {g.items.map((c) => (
                    <tr key={c.key}>
                      <td>{c.label}</td>
                      <td className="num" style={{ color: c.raw ? "var(--muted)" : c.value >= 0 ? "#4ade80" : "#f87171" }}>
                        {c.raw ? "por banda" : sign(c.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Section>

      {/* 6. Puntos de entrenador */}
      <Section id="entrenadores" title="6 · Puntos de entrenador">
        <p className="muted" style={{ fontSize: ".86rem", marginTop: -4 }}>Solo puntúa el entrenador elegido en el snapshot. Se calcula desde el partido de su equipo real.</p>
        <div className="card pad0">
          <table className="table">
            <tbody>
              {coachOn.map((c) => (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  <td className="num" style={{ color: c.value >= 0 ? "#4ade80" : "#f87171" }}>{sign(c.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 7. Economía */}
      <Section id="economia" title="7 · Economía y primas">
        <ul className="rules-list">
          <li><b>Prima por punto:</b> cada punto de jornada = <b>{eur(settings.prizePerPoint)}</b>, pagado a <b>todos</b> los equipos (incluso en rojo). Puntos negativos → 0 €.</li>
          <li><b>Valor de mercado</b> = calidad del jugador (rating) + sus puntos de temporada. Se recalcula cada jornada.</li>
          <li><b>Compensación (catch-up):</b> tras cada jornada, el dinero de ayuda crece según tu puesto: (puesto − 1) × <b>{eur(settings.compensationStep)}</b>. El último cobra más para poder remontar; al primero <b>no se le quita</b> nada.</li>
          <li><b>Promos anti-abandono:</b> los 2 últimos de la liga pueden recibir bonus aleatorios (capitán triple, puntos ×2, prima ×2 o jornada sin salario).</li>
          <li>Cada movimiento deja una <b>transacción</b> auditable (Mercado → Mi actividad).</li>
        </ul>
      </Section>

      {/* 8. Mercado */}
      <Section id="mercado" title="8 · Mercado y traspasos">
        <ul className="rules-list">
          <li><b>Agentes libres:</b> subasta ciega. Pujas ≥ precio de salida; al resolver (00:00) gana la más alta (empate → la primera). Se carga aunque quedes en rojo.</li>
          <li><b>Venta al banco:</b> vendes un jugador tuyo a su <b>valor</b> actual (no puedes bajar de 11).</li>
          <li><b>Cláusula de rescisión:</b> pagas <b>valor × {settings.clauseMultiplier}</b> para llevarte al jugador de otro mánager; el dinero va al vendedor.</li>
          <li><b>Transferibles (especulación):</b> pones a un jugador tuyo <b>en venta</b> con un precio de salida (por debajo de la cláusula). Aparece en «Jugadores de la liga» como transferible y los rivales pueden <b>pujar</b>; al resolver, gana la mejor puja y tú cobras.</li>
          <li>Los <b>entrenadores</b> se fichan y venden como los jugadores, pero <b>no tienen cláusula</b>.</li>
        </ul>
      </Section>

      {/* 9. Préstamos */}
      <Section id="prestamos" title="9 · Préstamos">
        <ul className="rules-list">
          <li>Hasta <b>3 préstamos</b> activos por equipo.</li>
          <li><b>Importe máximo</b> por préstamo = <b>50% de tu patrimonio</b> (saldo + valor de plantilla).</li>
          <li><b>Amortización francesa</b> (cuota constante) al <b>5% TAE</b>: una cuota por jornada hasta fin de temporada, cobrada a las 00:00.</li>
        </ul>
      </Section>

      {/* 10. Seguros */}
      <Section id="seguros" title="10 · Seguro médico">
        <ul className="rules-list">
          <li>Individual por jugador, tres niveles: <b>Básico +1</b>, <b>Medio +3</b>, <b>Avanzado +5</b>.</li>
          <li><b>Efecto:</b> si el jugador está <b>alineado</b> y <b>se lesiona</b> en la jornada, tu equipo suma ese bonus además de sus puntos.</li>
          <li><b>Contractual:</b> si vendes o pierdes al jugador (venta, cláusula, traspaso), <b>pierdes el seguro</b>; si fichas a uno asegurado, <b>no lo heredas</b>.</li>
        </ul>
      </Section>

      {/* 11. Estadio */}
      <Section id="estadio" title="11 · Estadio">
        <ul className="rules-list">
          <li>Cada mejora sube el <b>ingreso por asistencia</b>: ganas €/punto por cada punto que logra tu equipo cada jornada.</li>
          <li>Ahora estás en <b>nivel {stadium.level}</b> ({eur(stadium.rate)} por punto), de {stadium.maxLevel}.</li>
          <li>Además, las <b>vallas publicitarias</b> dan patrocinios por temporada.</li>
        </ul>
        <div className="card pad0" style={{ marginTop: 8 }}>
          <table className="table">
            <thead><tr><th>Nivel</th><th>Mejora</th><th style={{ textAlign: "right" }}>Coste</th><th style={{ textAlign: "right" }}>€/punto</th></tr></thead>
            <tbody>
              {stadium.progression.map((t) => (
                <tr key={t.level} className={t.level === stadium.level ? "you" : ""}>
                  <td className="rank">{t.level}</td><td>{t.name}</td>
                  <td className="num">{t.cost > 0 ? eur(t.cost) : "—"}</td>
                  <td className="num">{eur(t.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 12. Números rojos */}
      <Section id="rojos" title="12 · Números rojos">
        <ul className="rules-list">
          <li>Se llega gastando más de lo disponible (fichajes, salarios, seguro, cuotas mayores que tu caja).</li>
          <li>Un equipo en rojo en el snapshot: <b>NO suma</b> a la clasificación esa jornada, pero <b>SÍ genera</b> su prima por puntos.</li>
          <li><b>No puedes iniciar un fichaje</b> estando ya en rojo; sales del rojo con primas, ventas y préstamos.</li>
        </ul>
      </Section>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 90 }}>
      <div className="card-head" style={{ marginBottom: 0, marginTop: 8 }}><h2 style={{ fontSize: "1.15rem" }}>{title}</h2></div>
      {children}
    </section>
  );
}
