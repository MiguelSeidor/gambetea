-- Recalibración económica con el baremo enriquecido (ADR-017).
-- Cambia sólo los DEFAULT (ligas nuevas); las LeagueSettings existentes conservan su valor.
ALTER TABLE "LeagueSettings" ALTER COLUMN "prizePerPoint" SET DEFAULT 15000;
ALTER TABLE "LeagueSettings" ALTER COLUMN "salaryRate" SET DEFAULT 0.018;
ALTER TABLE "LeagueSettings" ALTER COLUMN "compensationStep" SET DEFAULT 250000;
