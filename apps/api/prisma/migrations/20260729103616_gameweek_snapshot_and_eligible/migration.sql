-- AlterTable
ALTER TABLE "FantasyGameweekScore" ADD COLUMN     "eligible" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "GameweekSnapshot" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "captainId" TEXT,
    "starters" TEXT[],
    "bench" TEXT[],
    "cash" INTEGER NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameweekSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameweekSnapshot_fantasyTeamId_gameweekId_key" ON "GameweekSnapshot"("fantasyTeamId", "gameweekId");

-- AddForeignKey
ALTER TABLE "GameweekSnapshot" ADD CONSTRAINT "GameweekSnapshot_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameweekSnapshot" ADD CONSTRAINT "GameweekSnapshot_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
