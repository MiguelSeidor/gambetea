-- CreateTable
CREATE TABLE "LeagueSettings" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "prizePerPoint" INTEGER NOT NULL DEFAULT 20000,
    "salaryRate" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "compensationStep" INTEGER NOT NULL DEFAULT 1000000,
    "tvRights" INTEGER NOT NULL DEFAULT 15000000,
    "initialBudget" INTEGER NOT NULL DEFAULT 200000000,
    "clauseMultiplier" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "LeagueSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueSettings_leagueId_key" ON "LeagueSettings"("leagueId");

-- AddForeignKey
ALTER TABLE "LeagueSettings" ADD CONSTRAINT "LeagueSettings_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
