-- CreateEnum ChatbotUserRole
DO $$ BEGIN
    CREATE TYPE "ChatbotUserRole" AS ENUM ('USER', 'PROVIDER', 'GUEST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum ChatbotMessageRole
DO $$ BEGIN
    CREATE TYPE "ChatbotMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable chatbot_conversations
CREATE TABLE IF NOT EXISTS "chatbot_conversations" (
    "id"             TEXT             NOT NULL,
    "userId"         TEXT,
    "guestSessionId" TEXT,
    "userRole"       "ChatbotUserRole" NOT NULL,
    "title"          TEXT,
    "createdAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)     NOT NULL,
    CONSTRAINT "chatbot_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chatbot_conversations_userId_idx" ON "chatbot_conversations"("userId");
CREATE INDEX IF NOT EXISTS "chatbot_conversations_guestSessionId_idx" ON "chatbot_conversations"("guestSessionId");

DO $$ BEGIN
    ALTER TABLE "chatbot_conversations"
        ADD CONSTRAINT "chatbot_conversations_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "chatbot_conversations"
        ADD CONSTRAINT "chatbot_conversations_guestSessionId_fkey"
        FOREIGN KEY ("guestSessionId") REFERENCES "guest_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable chatbot_messages
CREATE TABLE IF NOT EXISTS "chatbot_messages" (
    "id"             TEXT               NOT NULL,
    "conversationId" TEXT               NOT NULL,
    "role"           "ChatbotMessageRole" NOT NULL,
    "content"        TEXT               NOT NULL,
    "toolCalls"      JSONB,
    "toolResults"    JSONB,
    "imageUrls"      TEXT[]             NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt"      TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chatbot_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chatbot_messages_conversationId_idx" ON "chatbot_messages"("conversationId");

DO $$ BEGIN
    ALTER TABLE "chatbot_messages"
        ADD CONSTRAINT "chatbot_messages_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "chatbot_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
