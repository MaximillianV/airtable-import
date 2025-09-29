-- Dual Schema System - App and Data Schemas
-- Provider: PostgreSQL (DigitalOcean)

--
-- Create Schemas
--

-- Create 'app' schema for application management (authentication, sessions, settings)
CREATE SCHEMA IF NOT EXISTS "app";

-- Create 'data' schema for imported Airtable data and relationship analysis  
CREATE SCHEMA IF NOT EXISTS "data";

--
-- Create ENUM types in 'app' schema
--

-- Combines the initial status values with the 'PARTIAL_FAILED' addition.
CREATE TYPE "app"."ImportStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL_FAILED');

-- Creates the user role type from the 'add_user_role_system' migration.
CREATE TYPE "app"."UserRole" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');

--
-- Create APP Schema Tables
--

-- The 'users' table in 'app' schema
CREATE TABLE "app"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "app"."UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Settings table removed - Airtable configuration moved to environment variables

-- The 'import_sessions' table in 'app' schema
CREATE TABLE "app"."import_sessions" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "app"."ImportStatus" NOT NULL DEFAULT 'PENDING',
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "tableNames" TEXT[],
    "totalTables" INTEGER NOT NULL DEFAULT 0,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "results" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id")
);

-- The 'imported_tables' table in 'app' schema
CREATE TABLE "app"."imported_tables" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "airtableTableId" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "status" "app"."ImportStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imported_tables_pkey" PRIMARY KEY ("id")
);

-- The 'airtable_schemas' table in 'app' schema
CREATE TABLE "app"."airtable_schemas" (
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

--
-- Create DATA Schema Tables and Functions
--

-- Relationship analysis tables for modular relationship system in 'data' schema
CREATE TABLE "data"."relationship_analysis" (
    "id" SERIAL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "target_table" TEXT NOT NULL,
    "cardinality" TEXT CHECK (cardinality IN ('one-to-one', 'one-to-many', 'many-to-one', 'many-to-many')),
    "confidence_score" DECIMAL(3,2) DEFAULT 0.00,
    "total_records" INTEGER DEFAULT 0,
    "non_null_records" INTEGER DEFAULT 0,
    "unique_values" INTEGER DEFAULT 0,
    "analysis_data" JSONB,
    
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(session_id, table_name, field_name)
);

-- Junction table proposals for many-to-many relationships in 'data' schema
CREATE TABLE "data"."junction_proposal" (
    "id" SERIAL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "relationship_id" INTEGER REFERENCES "data"."relationship_analysis"(id) ON DELETE CASCADE,
    "junction_table_name" TEXT NOT NULL,
    "source_column" TEXT NOT NULL,
    "target_column" TEXT NOT NULL,
    "is_created" BOOLEAN DEFAULT FALSE,
    
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Foreign key proposals for relationship implementation in 'data' schema
CREATE TABLE "data"."foreign_key_proposal" (
    "id" SERIAL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "relationship_id" INTEGER REFERENCES "data"."relationship_analysis"(id) ON DELETE CASCADE,
    "source_table" TEXT NOT NULL,
    "source_column" TEXT NOT NULL,
    "target_table" TEXT NOT NULL,
    "target_column" TEXT NOT NULL,
    "is_created" BOOLEAN DEFAULT FALSE,
    
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced relationship analysis function in 'data' schema
CREATE OR REPLACE FUNCTION "data".analyze_relationships()
RETURNS TABLE(
    table_name text,
    field_name text,
    cardinality text,
    confidence_score numeric,
    total_records bigint,
    non_null_records bigint,
    unique_values bigint
) AS $$
DECLARE
    table_record record;
    field_record record;
    sql_query text;
    result_record record;
BEGIN
    -- Loop through all tables that have link fields (TEXT[] columns) in data schema
    FOR table_record IN 
        SELECT t.table_name
        FROM information_schema.tables t
        WHERE t.table_schema = 'data' 
        AND t.table_type = 'BASE TABLE'
        AND EXISTS (
            SELECT 1 
            FROM information_schema.columns c 
            WHERE c.table_name = t.table_name 
            AND c.table_schema = 'data'
            AND c.data_type = 'ARRAY'
        )
    LOOP
        -- Loop through TEXT[] fields in each table
        FOR field_record IN
            SELECT c.column_name
            FROM information_schema.columns c
            WHERE c.table_name = table_record.table_name
            AND c.table_schema = 'data'
            AND c.data_type = 'ARRAY'
        LOOP
            BEGIN
                -- Dynamic SQL to analyze the field
                sql_query := format('
                    SELECT 
                        %L as table_name,
                        %L as field_name,
                        COUNT(*) as total_records,
                        COUNT(%I) as non_null_records,
                        COUNT(DISTINCT %I) as unique_arrays
                    FROM "data".%I 
                    WHERE %I IS NOT NULL AND array_length(%I, 1) > 0',
                    table_record.table_name,
                    field_record.column_name,
                    field_record.column_name,
                    field_record.column_name,
                    table_record.table_name,
                    field_record.column_name,
                    field_record.column_name
                );

                -- Execute and return results
                FOR result_record IN EXECUTE sql_query
                LOOP
                    table_name := result_record.table_name;
                    field_name := result_record.field_name;
                    total_records := result_record.total_records;
                    non_null_records := result_record.non_null_records;
                    unique_values := result_record.unique_arrays;
                    
                    -- Determine cardinality based on data patterns
                    IF unique_values = non_null_records THEN
                        cardinality := 'one-to-many';
                        confidence_score := 0.95;
                    ELSIF unique_values < non_null_records * 0.1 THEN
                        cardinality := 'many-to-one';
                        confidence_score := 0.85;
                    ELSE
                        cardinality := 'many-to-many';
                        confidence_score := 0.75;
                    END IF;
                    
                    RETURN NEXT;
                END LOOP;
                
            EXCEPTION WHEN OTHERS THEN
                -- Skip problematic fields and continue
                CONTINUE;
            END;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

--
-- Create Indexes for APP Schema
--

CREATE UNIQUE INDEX "users_email_key" ON "app"."users"("email");
CREATE UNIQUE INDEX "imported_tables_sessionId_tableName_key" ON "app"."imported_tables"("sessionId", "tableName");
CREATE UNIQUE INDEX "airtable_schemas_tableName_key" ON "app"."airtable_schemas"("tableName");

--
-- Create Indexes for DATA Schema
--

CREATE INDEX "idx_relationship_analysis_session_id" ON "data"."relationship_analysis"("session_id");
CREATE INDEX "idx_relationship_analysis_cardinality" ON "data"."relationship_analysis"("cardinality");
CREATE INDEX "idx_junction_proposal_session_id" ON "data"."junction_proposal"("session_id");
CREATE INDEX "idx_foreign_key_proposal_session_id" ON "data"."foreign_key_proposal"("session_id");

--
-- Add Foreign Keys for APP Schema
--

ALTER TABLE "app"."import_sessions" ADD CONSTRAINT "import_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app"."imported_tables" ADD CONSTRAINT "imported_tables_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "app"."import_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;