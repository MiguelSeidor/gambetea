"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { api, type StandingRow } from "@/lib/api";

export default function Clasificacion() {
  const { leagueId, team } = useApp();
  const [rows, setRows] = useState<StandingRow[] | null>(null);

  useEffect(() => {
    void api.standings(leagueId).then(setRows);
  }, [leagueId]);

  return (
    <>
      <div className="page-head">
        <span className="eb">Clasificación</span>
        <h1>Clasificación</h1>
        <p>Puntos acumulados de todos los mánagers de la liga a lo largo de la temporada.</p>
      </div>

      <div className="card pad0">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              <th>Equipo</th>
              <th>Mánager</th>
              <th style={{ textAlign: "right" }}>Jornadas</th>
              <th style={{ textAlign: "right" }}>Puntos</th>
            </tr>
          </thead>
          <tbody>
            {!rows && <tr><td colSpan={5} className="muted">Cargando…</td></tr>}
            {rows?.map((r) => (
              <tr key={r.teamId} className={team && r.teamId === team.id ? "you" : ""}>
                <td className="rank">{r.rank}</td>
                <td>
                  <strong>{r.teamName}</strong>
                  {team && r.teamId === team.id && <span className="badge fit" style={{ marginLeft: 8 }}>Tú</span>}
                </td>
                <td className="muted">{r.manager}</td>
                <td className="num">{r.played}</td>
                <td className="num" style={{ fontFamily: "var(--disp)", fontSize: "1.15rem" }}>{r.points}</td>
              </tr>
            ))}
            {rows?.length === 0 && <tr><td colSpan={5} className="muted">Aún no hay jornadas puntuadas.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
