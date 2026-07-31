-- Ciclo de vida del jugador + feed de noticias (ADR-018)
CREATE TYPE "PlayerStatus" AS ENUM ('ACTIVE', 'LEFT', 'RETIRED');
CREATE TYPE "PlayerEventType" AS ENUM ('NEW_PLAYER', 'CLUB_CHANGE', 'TRANSFER_OUT', 'RETIREMENT', 'POSITION_CHANGE');

ALTER TABLE "Player" ADD COLUMN "status" "PlayerStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "PlayerEvent" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "type" "PlayerEventType" NOT NULL,
    "playerId" TEXT,
    "playerName" TEXT NOT NULL,
    "fromLabel" TEXT,
    "toLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlayerEvent_seasonId_createdAt_idx" ON "PlayerEvent"("seasonId", "createdAt");
ALTER TABLE "PlayerEvent" ADD CONSTRAINT "PlayerEvent_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
