-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('PLAYER', 'COACH');

-- AlterEnum
ALTER TYPE "TxType" ADD VALUE 'SALARY';

-- DropForeignKey
ALTER TABLE "MarketListing" DROP CONSTRAINT "MarketListing_playerId_fkey";

-- DropIndex
DROP INDEX "RosterCoach_fantasyTeamId_key";

-- AlterTable
ALTER TABLE "Coach" ADD COLUMN     "value" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FantasyLineup" ADD COLUMN     "coachId" TEXT;

-- AlterTable
ALTER TABLE "GameweekSnapshot" ADD COLUMN     "coachId" TEXT;

-- AlterTable
ALTER TABLE "MarketListing" ADD COLUMN     "coachId" TEXT,
ADD COLUMN     "kind" "ListingKind" NOT NULL DEFAULT 'PLAYER',
ALTER COLUMN "playerId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RosterCoach_fantasyTeamId_coachId_key" ON "RosterCoach"("fantasyTeamId", "coachId");

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;
