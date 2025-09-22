-- CreateEnum
CREATE TYPE "public"."ImportStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."settings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "airtableApiKey" TEXT,
    "airtableBaseId" TEXT,
    "databaseUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."import_sessions" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "public"."ImportStatus" NOT NULL DEFAULT 'PENDING',
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "tableNames" TEXT[],
    "totalTables" INTEGER NOT NULL DEFAULT 0,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."imported_tables" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "airtableTableId" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."ImportStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imported_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."airtable_schemas" (
    "id" SERIAL NOT NULL,
    "tableName" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "airtableId" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "lastSync" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airtable_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "settings_userId_key" ON "public"."settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "imported_tables_sessionId_tableName_key" ON "public"."imported_tables"("sessionId", "tableName");

-- CreateIndex
CREATE UNIQUE INDEX "airtable_schemas_tableName_key" ON "public"."airtable_schemas"("tableName");

-- AddForeignKey
ALTER TABLE "public"."settings" ADD CONSTRAINT "settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_sessions" ADD CONSTRAINT "import_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."imported_tables" ADD CONSTRAINT "imported_tables_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."import_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
