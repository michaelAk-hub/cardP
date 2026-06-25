-- CreateEnum
CREATE TYPE "PrincipalType" AS ENUM ('student', 'admin');

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "disabled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "principal_type" "PrincipalType" NOT NULL,
    "principal_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_principal_id_principal_type_idx" ON "refresh_tokens"("principal_id", "principal_type");
