import { FootballDataProvider } from "../provider.port";
import { ApiFootballProvider } from "./api-football/api-football.provider";
import { MockProvider } from "./mock/mock.provider";

/**
 * Elige el proveedor del Football Data Hub según `DATA_PROVIDER` (ADR-019).
 * Cambiar de proveedor = cambiar una variable de entorno, sin tocar el resto del sistema.
 */
export function createProvider(): FootballDataProvider {
  const which = (process.env.DATA_PROVIDER ?? "mock").toLowerCase();
  if (which === "api-football") return new ApiFootballProvider();
  return new MockProvider();
}
