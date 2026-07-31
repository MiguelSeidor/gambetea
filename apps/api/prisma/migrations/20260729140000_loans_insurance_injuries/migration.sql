-- CreateEnum
CREATE TYPE "InsuranceTier" AS ENUM ('BASIC', 'MEDIUM', 'ADVANCED');

-- AlterEnum
ALTER TYPE "MatchEventType" ADD VALUE 'INJURY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TxType" ADD VALUE 'INSURANCE';
ALTER TYPE "TxType" ADD VALUE 'LOAN';
ALTER TYPE "TxType" ADD VALUE 'LOAN_REPAY';

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "ratePerGw" DOUBLE PRECISION NOT NULL,
    "installment" INTEGER NOT NULL,
    "outstanding" INTEGER NOT NULL,
    "installmentsTotal" INTEGER NOT NULL,
    "installmentsPaid" INTEGER NOT NULL DEFAULT 0,
    "lastChargedGameweekId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerInsurance" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "tier" "InsuranceTier" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Loan_fantasyTeamId_status_idx" ON "Loan"("fantasyTeamId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerInsurance_fantasyTeamId_playerId_key" ON "PlayerInsurance"("fantasyTeamId", "playerId");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerInsurance" ADD CONSTRAINT "PlayerInsurance_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerInsurance" ADD CONSTRAINT "PlayerInsurance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
