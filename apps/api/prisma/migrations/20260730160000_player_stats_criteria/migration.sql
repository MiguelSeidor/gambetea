-- AlterTable: estadísticas de conteo por aparición (ADR-015)
ALTER TABLE "Appearance" ADD COLUMN     "stats" JSONB;

-- AlterTable: overrides del baremo de jugador por liga (ADR-015)
ALTER TABLE "LeagueSettings" ADD COLUMN     "playerCriteria" JSONB;
