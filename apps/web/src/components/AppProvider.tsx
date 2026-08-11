"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import {
  api,
  clearSession,
  getToken,
  getUser,
  setLeagueId,
  type LeagueSummary,
  type SessionUser,
  type TeamView,
} from "@/lib/api";
import { eur } from "@/lib/format";

interface AppCtx {
  user: SessionUser;
  leagues: LeagueSummary[];
  leagueId: string;
  league: LeagueSummary | null; // null en modo admin (el superadmin no juega ninguna liga)
  team: TeamView | null;
  gwNumber: number | null;
  selectLeague: (id: string) => Promise<void>;
  goToLobby: () => void;
  refresh: () => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp debe usarse dentro de AppProvider");
  return c;
}

type Phase = "loading" | "lobby" | "ready" | "admin" | "error";

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [leagueId, setLid] = useState<string>("");
  const [team, setTeam] = useState<TeamView | null>(null);
  const [gwNumber, setGwNumber] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const loadLeagueData = useCallback(async (lid: string) => {
    const [t, lu] = await Promise.all([api.team(lid), api.lineup(lid).catch(() => null)]);
    setTeam(t);
    setGwNumber(lu?.gameweek.number ?? null);
  }, []);

  const load = useCallback(async () => {
    try {
      const u = getUser();
      setUser(u);
      // El superadministrador no juega ninguna liga: va directo al panel de administración.
      if (u?.isAdmin) {
        setLeagues(await api.myLeagues().catch(() => []));
        setPhase("admin");
        router.replace("/admin");
        return;
      }
      const ls = await api.myLeagues();
      setLeagues(ls);
      // Usuario normal: siempre al lobby para elegir liga (entrar / crear / unirse).
      setPhase("lobby");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error");
      setPhase("error");
    }
  }, [loadLeagueData, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void load();
  }, [load, router]);

  const selectLeague = useCallback(
    async (id: string) => {
      setLeagueId(id);
      setLid(id);
      setPhase("loading");
      // Si la liga no está en la lista (recién creada/unida), refresca para que 'league' no sea null.
      if (!leagues.some((l) => l.id === id)) {
        const ls = await api.myLeagues().catch(() => leagues);
        setLeagues(ls);
      }
      await loadLeagueData(id);
      setPhase("ready");
    },
    [leagues, loadLeagueData],
  );

  const refresh = useCallback(async () => {
    if (leagueId) await loadLeagueData(leagueId);
  }, [leagueId, loadLeagueData]);

  const goToLobby = useCallback(() => {
    setLid("");
    setTeam(null);
    setPhase("lobby");
  }, []);

  const deleteLeague = useCallback(async (id: string) => {
    await api.deleteLeague(id);
    setLeagues(await api.myLeagues().catch(() => []));
  }, []);

  const logout = useCallback(() => {
    clearSession();
    router.replace("/login");
  }, [router]);

  if (phase === "loading") return <FullScreen>Cargando…</FullScreen>;
  if (phase === "error")
    return (
      <FullScreen>
        <p style={{ color: "#f87171" }}>No se pudo cargar: {errorMsg}</p>
        <button className="btn" onClick={() => location.reload()} style={{ marginTop: 16 }}><span>Reintentar</span></button>
      </FullScreen>
    );
  if (phase === "lobby") return <Lobby user={user} leagues={leagues} onEnter={selectLeague} onDelete={deleteLeague} onLogout={logout} />;

  const league = leagues.find((l) => l.id === leagueId) ?? null;
  const value: AppCtx = { user: user!, leagues, leagueId, league, team, gwNumber, selectLeague, goToLobby, refresh, logout };
  return (
    <Ctx.Provider value={value}>
      <Shell>{children}</Shell>
    </Ctx.Provider>
  );
}

// ===== Layout autenticado (shell) ==========================================

type IconName = React.ComponentProps<typeof Icon>["name"];
type NavItem = { href: string; label: string; icon: IconName };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    group: "Mi equipo",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" as const },
      { href: "/plantilla", label: "Plantilla", icon: "squad" as const },
      { href: "/alineacion", label: "Alineación", icon: "pitch" as const },
      { href: "/finanzas", label: "Finanzas", icon: "wallet" as const },
    ],
  },
  {
    group: "Competición",
    items: [
      { href: "/mercado", label: "Mercado", icon: "market" as const },
      { href: "/entrenadores", label: "Entrenadores", icon: "coach" as const },
      { href: "/estadio", label: "Estadio", icon: "stadium" as const },
      { href: "/clasificacion", label: "Clasificación", icon: "table" as const },
      { href: "/jornadas", label: "Jornadas", icon: "list" as const },
      { href: "/reglas", label: "Reglas", icon: "book" as const },
      { href: "/liga", label: "Config liga", icon: "spark" as const },
    ],
  },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/plantilla": "Plantilla",
  "/alineacion": "Alineación",
  "/finanzas": "Finanzas",
  "/mercado": "Mercado",
  "/entrenadores": "Entrenadores",
  "/estadio": "Estadio",
  "/clasificacion": "Clasificación",
  "/jornadas": "Jornadas",
  "/reglas": "Reglas",
  "/liga": "Config liga",
  "/admin": "Administración",
};

const ADMIN_GROUP: NavGroup = {
  group: "Administración",
  items: [{ href: "/admin", label: "Admin global", icon: "shield" as const }],
};

// Pestañas principales de la barra inferior en móvil (las 4 pantallas más usadas).
// El resto (clasificación, finanzas, entrenadores, estadio, reglas, config) va a "Más".
const PRIMARY_HREFS = ["/dashboard", "/plantilla", "/alineacion", "/mercado"];

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, team, gwNumber, leagues, leagueId, league, selectLeague, goToLobby, logout } = useApp();
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false); // hoja "Más" en móvil
  const sheetRef = useRef<HTMLDivElement>(null);
  const adminMode = !!user.isAdmin; // solo el superadmin ve el shell de admin (no "no tener liga")
  const title = TITLES[path] ?? "Gambetea";
  const initial = (team?.name ?? user.displayName).charAt(0).toUpperCase();
  const navGroups = adminMode ? [ADMIN_GROUP] : NAV;

  // Navegación móvil: barra inferior con los ítems principales + "Más" para el resto.
  // Los 4 ítems principales se eligen A PROPÓSITO (los de mayor frecuencia de uso),
  // no por orden: mercado y clasificación pesan más que finanzas en un fantasy.
  const flatNav = navGroups.flatMap((g) => g.items);
  const primaryNav = adminMode
    ? flatNav // en admin solo hay un ítem: va directo a la barra
    : (PRIMARY_HREFS.map((h) => flatNav.find((it) => it.href === h)).filter(Boolean) as NavItem[]);
  const overflowNav = flatNav.filter((it) => !primaryNav.includes(it));
  const overflowActive = overflowNav.some((it) => it.href === path);

  // En modo admin solo tiene sentido el panel de administración.
  useEffect(() => {
    if (adminMode && path !== "/admin") router.replace("/admin");
  }, [adminMode, path, router]);

  // Cierra la hoja "Más" al cambiar de ruta (p. ej. al pulsar un ítem de dentro).
  useEffect(() => { setMoreOpen(false); }, [path]);

  // Al volver a escritorio (sidebar visible) la hoja "Más" deja de tener sentido.
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 900) setMoreOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Accesibilidad de la hoja "Más": bloqueo de scroll de fondo, foco atrapado
  // dentro de la hoja, foco inicial al abrir y devolución del foco al cerrar,
  // y cierre con Escape (mismo patrón que Modal.tsx).
  useEffect(() => {
    if (!moreOpen) return;
    const prevFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const sheet = sheetRef.current;
    const focusables = () =>
      sheet
        ? Array.from(
            sheet.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];
    (focusables()[0] ?? sheet)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setMoreOpen(false); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !sheet?.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocused?.focus?.();
    };
  }, [moreOpen]);

  return (
    <div className="shell">
      <aside className="side">
        <Link className="side-brand" href={adminMode ? "/admin" : "/dashboard"} aria-label="Gambetea">
          <img src="/brand/crest.webp" alt="" width={30} height={34} />
          <span className="wm">Gambetea</span>
        </Link>

        {!adminMode && (
          <>
            {leagues.length > 1 && (
              <select
                className="league-switch"
                value={leagueId}
                onChange={(e) => void selectLeague(e.target.value)}
                aria-label="Cambiar de liga"
              >
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
            <button className="league-switch" onClick={goToLobby} style={{ textAlign: "left", cursor: "pointer" }}>← Mis ligas</button>
          </>
        )}

        {navGroups.map((g) => (
          <div key={g.group}>
            <div className="side-label">{g.group}</div>
            <nav className="side-nav">
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className={`nav-item${path === it.href ? " active" : ""}`}>
                  <Icon name={it.icon} />
                  <span className="t">{it.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        ))}

        <div className="side-foot">
          <div className="user-chip">
            <span className="avatar">{initial}</span>
            <span className="um">{adminMode ? "Administrador" : (team?.name ?? "Mi equipo")}<small>{user.displayName}</small></span>
            <button onClick={logout} className="icon-btn" style={{ marginLeft: "auto", width: 32, height: 32 }} aria-label="Salir">
              <Icon name="logout" size={16} />
            </button>
          </div>
          <button className="side-pw" onClick={() => setChangePwOpen(true)}>Cambiar contraseña</button>
        </div>
      </aside>

      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} />

      <div className="main">
        <header className="topbar">
          <div className="tb-title">{title}</div>
          <div className="tb-right">
            {adminMode ? (
              <div className="tb-stat"><span className="k">Rol</span><span className="v">Superadmin</span></div>
            ) : (
              <>
                {/* En móvil se ocultan Liga (visible en la hoja "Más") y Saldo (visible en el contenido). */}
                <div className="tb-stat tb-liga"><span className="k">Liga</span><span className="v">{league?.name}</span></div>
                <div className="tb-stat tb-saldo"><span className="k">Saldo</span><span className="v">{team ? eur(team.budget) : "—"}</span></div>
                <div className="tb-stat"><span className="k">Jornada</span><span className="v">{gwNumber ? `J${gwNumber}` : "—"}</span></div>
              </>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      {/* ===== NAVEGACIÓN MÓVIL: barra inferior (thumb-friendly) ===== */}
      <nav className="botnav" aria-label="Navegación principal">
        {primaryNav.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`botnav-item${path === it.href ? " active" : ""}`}
            aria-current={path === it.href ? "page" : undefined}
          >
            <Icon name={it.icon} />
            <span className="t">{it.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`botnav-item${overflowActive || moreOpen ? " active" : ""}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <Icon name="more" />
          <span className="t">Más</span>
        </button>
      </nav>

      {/* Hoja "Más": resto de secciones + controles secundarios (liga, salir, contraseña) */}
      {moreOpen && (
        <div className="sheet-overlay" role="presentation" onClick={() => setMoreOpen(false)}>
          <div className="sheet" ref={sheetRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Más opciones" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span className="sheet-brand">
                <img src="/brand/crest.webp" alt="" width={26} height={29} />
                <span className="wm">Gambetea</span>
              </span>
              <button className="icon-btn" onClick={() => setMoreOpen(false)} aria-label="Cerrar">
                <Icon name="close" size={16} />
              </button>
            </div>

            {!adminMode && (
              <div className="sheet-league">
                {leagues.length > 1 && (
                  <select
                    className="league-switch"
                    value={leagueId}
                    onChange={(e) => void selectLeague(e.target.value)}
                    aria-label="Cambiar de liga"
                  >
                    {leagues.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                )}
                <button className="league-switch" onClick={() => { setMoreOpen(false); goToLobby(); }}>← Mis ligas</button>
              </div>
            )}

            {overflowNav.length > 0 && (
              <nav className="sheet-nav" aria-label="Más secciones">
                {overflowNav.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`sheet-item${path === it.href ? " active" : ""}`}
                    aria-current={path === it.href ? "page" : undefined}
                  >
                    <Icon name={it.icon} />
                    <span>{it.label}</span>
                  </Link>
                ))}
              </nav>
            )}

            <div className="sheet-foot">
              <div className="user-chip">
                <span className="avatar">{initial}</span>
                <span className="um">{adminMode ? "Administrador" : (team?.name ?? "Mi equipo")}<small>{user.displayName}</small></span>
                <button onClick={logout} className="icon-btn" style={{ marginLeft: "auto", width: 32, height: 32 }} aria-label="Salir">
                  <Icon name="logout" size={16} />
                </button>
              </div>
              <button className="side-pw" onClick={() => { setMoreOpen(false); setChangePwOpen(true); }}>Cambiar contraseña</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Lobby (entrar a tus ligas · crear · unirse) =========================

function Lobby({
  user, leagues, onEnter, onDelete, onLogout,
}: {
  user: SessionUser | null;
  leagues: LeagueSummary[];
  onEnter: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onLogout: () => void;
}) {
  const [mode, setMode] = useState<"create" | "join">(leagues.length ? "create" : "create");
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(id: string, name: string) {
    if (!window.confirm(`¿Borrar la liga "${name}"? Se eliminan todos sus equipos y plantillas. No se puede deshacer.`)) return;
    setDeleting(id);
    setError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar la liga");
    } finally {
      setDeleting(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === "create"
          ? await api.createLeague({ name, teamName: teamName || undefined })
          : await api.joinLeague({ inviteCode: inviteCode.trim().toUpperCase(), teamName: teamName || undefined });
      await onEnter(res.id); // entra directamente a la liga recién creada/unida
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap" style={{ alignItems: "flex-start", paddingTop: "6vh" }}>
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <div className="auth-brand" style={{ justifyContent: "space-between", width: "100%" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <img src="/brand/crest.webp" alt="" width={32} height={36} />
            <span className="wm">Gambetea</span>
          </span>
          <button className="chip" onClick={onLogout}>Salir</button>
        </div>
        <h1>Hola, {user?.displayName ?? "jugador"}</h1>
        <p className="sub">Entra a una de tus ligas, crea una nueva o únete con un código.</p>

        {leagues.length > 0 && (
          <div style={{ display: "grid", gap: 10, margin: "6px 0 20px" }}>
            {leagues.map((l) => (
              <div key={l.id} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                <button className="lobby-league" style={{ flex: 1 }} onClick={() => void onEnter(l.id)}>
                  <span className="ll-main">
                    <b>{l.name}</b>
                    <small>{l.competition} · {l.memberCount} mánager{l.memberCount === 1 ? "" : "s"} · {l.role === "OWNER" ? "creador" : "miembro"}</small>
                  </span>
                  <span className="ll-go">Entrar →</span>
                </button>
                {l.role === "OWNER" && (
                  <button className="chip" title="Borrar liga" aria-label={`Borrar liga ${l.name}`}
                    disabled={deleting === l.id} onClick={() => void remove(l.id, l.name)}
                    style={{ flex: "0 0 auto", alignSelf: "center" }}>
                    {deleting === l.id ? "…" : "🗑"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="onb-tabs">
          <button type="button" className={mode === "create" ? "on" : ""} onClick={() => setMode("create")}>Crear liga</button>
          <button type="button" className={mode === "join" ? "on" : ""} onClick={() => setMode("join")}>Unirme por código</button>
        </div>

        <form onSubmit={submit}>
          {mode === "create" ? (
            <div className="field">
              <label htmlFor="ln">Nombre de la liga</label>
              <input id="ln" value={name} onChange={(e) => setName(e.target.value)} placeholder="Liga de los amigos" required minLength={3} />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="ic">Código de invitación</label>
              <input id="ic" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="ABC123" required minLength={6} maxLength={6} style={{ textTransform: "uppercase" }} />
            </div>
          )}
          <div className="field">
            <label htmlFor="tn">Nombre de tu equipo</label>
            <input id="tn" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Real Gambeta CF" />
          </div>

          {error && <p className="auth-error">{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            <span>{loading ? "…" : mode === "create" ? "Crear y entrar" : "Unirme y entrar"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div>{children}</div>
    </div>
  );
}
