-- Variacion diaria del valor de mercado (ADR-022): permite mostrar el up/down del dia.
ALTER TABLE "Player" ADD COLUMN "valueDelta" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Coach" ADD COLUMN "valueDelta" INTEGER NOT NULL DEFAULT 0;
