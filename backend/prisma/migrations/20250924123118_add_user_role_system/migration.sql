-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "role" "public"."UserRole" NOT NULL DEFAULT 'USER';
