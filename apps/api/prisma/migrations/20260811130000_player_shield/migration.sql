-- Blindaje (ADR-021): impide el pago de clausula de un jugador; cuesta su valor por semana.

-- Nuevo tipo de movimiento economico.
ALTER TYPE "TxType" ADD VALUE 'SHIELD';

-- Tabla de blindajes.
CREATE TABLE "PlayerShield" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerShield_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerShield_fantasyTeamId_playerId_key" ON "PlayerShield"("fantasyTeamId", "playerId");

ALTER TABLE "PlayerShield" ADD CONSTRAINT "PlayerShield_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerShield" ADD CONSTRAINT "PlayerShield_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
