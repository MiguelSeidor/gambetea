// @gambetea/domain — contratos compartidos entre apps/web y apps/api.
// Fuente única de verdad de tipos de dominio e interfaces de puertos.
// NOTA: esqueleto inicial (Sprint 0). El modelo completo se define en el Sprint 1 (ADR-006).

/** Identificador interno. Nunca exponemos IDs de proveedor aguas abajo. */
export type Id = string;

export type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";

export interface Competition {
  id: Id;
  name: string;
  season: string;
}

export interface Team {
  id: Id;
  competitionId: Id;
  name: string;
  shortName: string;
}

export interface Player {
  id: Id;
  teamId: Id;
  name: string;
  position: PlayerPosition;
}

export interface Coach {
  id: Id;
  teamId: Id | null;
  name: string;
}

// El PUERTO del proveedor (FootballDataProvider) y sus DTOs viven en el módulo Data Hub de
// la API (apps/api/src/data-hub/provider.port.ts): es un contrato de infraestructura del
// backend, no un tipo compartido con el frontend. Aquí quedan solo los tipos de dominio
// compartidos (entidades) que la UI también podrá consumir.
