// Datos mock (LaLiga) para maquetar las secciones premium mientras no hay backend.
// Coherente con ADR-001 (proveedor mock · LaLiga). Se sustituyen por datos reales del Data Hub.

export type Pos = "GK" | "DEF" | "MID" | "FWD";
export type Status = "fit" | "inj" | "susp";

export interface Player {
  id: string;
  name: string;
  team: string;
  pos: Pos;
  price: number;
  pts: number;
  form: number; // últimos 5
  status: Status;
}

export const MANAGER = {
  managerName: "Míster",
  teamName: "Real Gambeta CF",
  budget: 4_200_000,
  rank: 3,
  totalManagers: 12,
  points: 684,
  gwPoints: 54,
  gw: 24,
  squadValue: 82_400_000,
};

const LALIGA = [
  "Real Madrid", "Barcelona", "Atlético", "Athletic", "Real Sociedad", "Betis",
  "Villarreal", "Valencia", "Sevilla", "Girona", "Osasuna", "Celta",
];

export const SQUAD: Player[] = [
  { id: "p1", name: "Courtois", team: "Real Madrid", pos: "GK", price: 8_100_000, pts: 121, form: 24, status: "fit" },
  { id: "p2", name: "Carvajal", team: "Real Madrid", pos: "DEF", price: 9_400_000, pts: 148, form: 31, status: "fit" },
  { id: "p3", name: "Koundé", team: "Barcelona", pos: "DEF", price: 8_800_000, pts: 132, form: 27, status: "fit" },
  { id: "p4", name: "Le Normand", team: "Atlético", pos: "DEF", price: 7_200_000, pts: 118, form: 22, status: "fit" },
  { id: "p5", name: "Balde", team: "Barcelona", pos: "DEF", price: 6_900_000, pts: 104, form: 18, status: "inj" },
  { id: "p6", name: "Pedri", team: "Barcelona", pos: "MID", price: 11_600_000, pts: 176, form: 38, status: "fit" },
  { id: "p7", name: "Bellingham", team: "Real Madrid", pos: "MID", price: 13_900_000, pts: 214, form: 44, status: "fit" },
  { id: "p8", name: "Zubimendi", team: "Real Sociedad", pos: "MID", price: 8_200_000, pts: 139, form: 26, status: "susp" },
  { id: "p9", name: "Nico Williams", team: "Athletic", pos: "FWD", price: 12_100_000, pts: 188, form: 41, status: "fit" },
  { id: "p10", name: "Lewandowski", team: "Barcelona", pos: "FWD", price: 12_800_000, pts: 197, form: 35, status: "fit" },
  { id: "p11", name: "Vinícius", team: "Real Madrid", pos: "FWD", price: 14_500_000, pts: 231, form: 47, status: "fit" },
  { id: "p12", name: "Remiro", team: "Real Sociedad", pos: "GK", price: 5_600_000, pts: 96, form: 19, status: "fit" },
  { id: "p13", name: "Baena", team: "Villarreal", pos: "MID", price: 7_800_000, pts: 128, form: 29, status: "fit" },
  { id: "p14", name: "Oyarzabal", team: "Real Sociedad", pos: "FWD", price: 8_900_000, pts: 141, form: 24, status: "fit" },
  { id: "p15", name: "Cubarsí", team: "Barcelona", pos: "DEF", price: 6_400_000, pts: 99, form: 21, status: "fit" },
];

/** XI titular (4-3-3) con posición relativa en el campo (x: 0-100, y: 0-100). */
export const LINEUP: { player: Player; x: number; y: number }[] = [
  { player: SQUAD[0], x: 50, y: 92 },
  { player: SQUAD[1], x: 82, y: 70 },
  { player: SQUAD[2], x: 60, y: 74 },
  { player: SQUAD[3], x: 40, y: 74 },
  { player: SQUAD[14], x: 18, y: 70 },
  { player: SQUAD[6], x: 50, y: 48 },
  { player: SQUAD[5], x: 72, y: 50 },
  { player: SQUAD[12], x: 28, y: 50 },
  { player: SQUAD[8], x: 80, y: 22 },
  { player: SQUAD[10], x: 50, y: 16 },
  { player: SQUAD[9], x: 20, y: 22 },
];

export const BENCH: Player[] = [SQUAD[11], SQUAD[13], SQUAD[4], SQUAD[7]];

export const STANDINGS = [
  { pos: 1, team: "Los Galácticos FC", manager: "Sergio", pts: 742, gw: 61 },
  { pos: 2, team: "Tiki-Taka United", manager: "Laura", pts: 711, gw: 48 },
  { pos: 3, team: "Real Gambeta CF", manager: "Míster", pts: 684, gw: 54, you: true },
  { pos: 4, team: "Depor del Sofá", manager: "Iván", pts: 662, gw: 39 },
  { pos: 5, team: "Cañería FC", manager: "Marta", pts: 640, gw: 45 },
  { pos: 6, team: "Los Cracks", manager: "Dani", pts: 618, gw: 42 },
  { pos: 7, team: "Peña Rabona", manager: "Nacho", pts: 590, gw: 37 },
  { pos: 8, team: "Sombrero City", manager: "Bea", pts: 566, gw: 40 },
];

export const FIXTURES = [
  { home: "Real Madrid", away: "Girona", date: "Sáb 18:30" },
  { home: "Barcelona", away: "Valencia", date: "Sáb 21:00" },
  { home: "Atlético", away: "Athletic", date: "Dom 16:15" },
  { home: "Betis", away: "Real Sociedad", date: "Dom 18:30" },
  { home: "Villarreal", away: "Sevilla", date: "Dom 21:00" },
];

export const MARKET: Player[] = [
  { id: "m1", name: "Sørloth", team: "Atlético", pos: "FWD", price: 9_100_000, pts: 152, form: 33, status: "fit" },
  { id: "m2", name: "Isco", team: "Betis", pos: "MID", price: 8_400_000, pts: 147, form: 30, status: "fit" },
  { id: "m3", name: "Rúben Dias", team: "Girona", pos: "DEF", price: 6_800_000, pts: 112, form: 25, status: "fit" },
  { id: "m4", name: "Güler", team: "Real Madrid", pos: "MID", price: 7_600_000, pts: 108, form: 34, status: "fit" },
  { id: "m5", name: "Ayoze", team: "Villarreal", pos: "FWD", price: 7_300_000, pts: 131, form: 28, status: "fit" },
  { id: "m6", name: "Unai Simón", team: "Athletic", pos: "GK", price: 6_200_000, pts: 104, form: 22, status: "fit" },
];

export interface Coach {
  id: string;
  name: string;
  team: string;
  price: number;
  pts: number;
  form: number;
  style: string;
}

export const COACHES: Coach[] = [
  { id: "c1", name: "Simeone", team: "Atlético", price: 9_800_000, pts: 168, form: 34, style: "Defensivo · intensidad" },
  { id: "c2", name: "Xabi Alonso", team: "Leverkusen", price: 11_200_000, pts: 201, form: 42, style: "Posesión · presión alta" },
  { id: "c3", name: "Ancelotti", team: "Real Madrid", price: 10_400_000, pts: 187, form: 38, style: "Gestión · equilibrio" },
  { id: "c4", name: "Marcelino", team: "Villarreal", price: 7_100_000, pts: 129, form: 26, style: "Bloque · transiciones" },
];

export const MY_COACH = COACHES[0];

export interface Upgrade {
  name: string;
  desc: string;
  level: number;
  maxLevel: number;
  effect: string;
  owned: boolean;
}

export const STADIUM = {
  name: "Estadio La Gambeta",
  level: 4,
  capacity: 38_500,
  fanHappiness: 78,
  upgrades: [
    { name: "Grada Sur", desc: "Aumenta el aforo y los ingresos por jornada.", level: 3, maxLevel: 5, effect: "+8% ingresos", owned: true },
    { name: "Césped híbrido", desc: "Mejora el rendimiento de tus jugadores locales.", level: 2, maxLevel: 4, effect: "+3% puntos en casa", owned: true },
    { name: "Academia", desc: "Descuento en fichajes de jóvenes promesas.", level: 1, maxLevel: 3, effect: "-5% precio sub-21", owned: true },
    { name: "Palcos VIP", desc: "Inyección económica extra cada jornada.", level: 0, maxLevel: 3, effect: "+250k / jornada", owned: false },
    { name: "Muro (afición)", desc: "Penaliza a los rivales que visitan tu estadio.", level: 0, maxLevel: 3, effect: "-4% puntos rival", owned: false },
  ] as Upgrade[],
};

export function eur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k €`;
  return `${n} €`;
}
