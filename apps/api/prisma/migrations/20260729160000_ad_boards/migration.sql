-- CreateEnum
CREATE TYPE "AdSide" AS ENUM ('NORTH', 'SOUTH', 'EAST', 'WEST');

-- CreateTable
CREATE TABLE "AdBoardOffer" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "side" "AdSide" NOT NULL,
    "brand" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdBoardOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdContract" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "side" "AdSide" NOT NULL,
    "brand" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "seasonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdContract_fantasyTeamId_side_key" ON "AdContract"("fantasyTeamId", "side");

-- AddForeignKey
ALTER TABLE "AdBoardOffer" ADD CONSTRAINT "AdBoardOffer_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdContract" ADD CONSTRAINT "AdContract_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
