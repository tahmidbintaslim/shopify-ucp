-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantProfile" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "brandVoice" TEXT NOT NULL DEFAULT 'friendly and professional',
    "returnPolicy" TEXT,
    "shippingInfo" TEXT,
    "minFreeShipping" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentInteraction" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "sessionId" TEXT,
    "userIntent" TEXT NOT NULL,
    "inputQuery" TEXT,
    "agentResponse" TEXT,
    "checkoutId" TEXT,
    "checkoutUrl" TEXT,
    "potentialValue" DOUBLE PRECISION,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT,
    "orderValue" DOUBLE PRECISION,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissedOpportunity" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "searchTerm" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissedOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_shop_key" ON "Session"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantProfile_shop_key" ON "MerchantProfile"("shop");

-- CreateIndex
CREATE INDEX "MerchantProfile_shop_idx" ON "MerchantProfile"("shop");

-- CreateIndex
CREATE INDEX "MerchantProfile_isEnabled_idx" ON "MerchantProfile"("isEnabled");

-- CreateIndex
CREATE INDEX "AgentInteraction_merchantId_idx" ON "AgentInteraction"("merchantId");

-- CreateIndex
CREATE INDEX "AgentInteraction_converted_idx" ON "AgentInteraction"("converted");

-- CreateIndex
CREATE INDEX "AgentInteraction_timestamp_idx" ON "AgentInteraction"("timestamp");

-- CreateIndex
CREATE INDEX "AgentInteraction_checkoutId_idx" ON "AgentInteraction"("checkoutId");

-- CreateIndex
CREATE INDEX "MissedOpportunity_shop_idx" ON "MissedOpportunity"("shop");

-- CreateIndex
CREATE INDEX "MissedOpportunity_count_idx" ON "MissedOpportunity"("count");

-- CreateIndex
CREATE UNIQUE INDEX "MissedOpportunity_shop_searchTerm_key" ON "MissedOpportunity"("shop", "searchTerm");

-- AddForeignKey
ALTER TABLE "MerchantProfile" ADD CONSTRAINT "MerchantProfile_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Session"("shop") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInteraction" ADD CONSTRAINT "AgentInteraction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "MerchantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

