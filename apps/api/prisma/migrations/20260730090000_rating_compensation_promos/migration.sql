-- CreateEnum
CREATE TYPE "PromoKind" AS ENUM ('DOUBLE_PRIZE', 'NO_SALARY', 'TRIPLE_CAPTAIN', 'DOUBLE_POINTS');

-- AlterEnum
ALTER TYPE "TxType" ADD VALUE 'COMPENSATION';

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 70;

-- CreateTable
CREATE TABLE "TeamPromo" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "kind" "PromoKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamPromo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamPromo_fantasyTeamId_gameweekId_key" ON "TeamPromo"("fantasyTeamId", "gameweekId");

-- AddForeignKey
ALTER TABLE "TeamPromo" ADD CONSTRAINT "TeamPromo_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
