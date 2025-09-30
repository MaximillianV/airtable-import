-- Data Database Schema for Airtable Import System
-- This is the remote database that contains all import data, relationship analysis, and Airtable schemas
-- Created and managed automatically when users set up database connections

-- Import session tracking - lowercase singular naming
CREATE TABLE IF NOT EXISTS import_session (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id INTEGER NOT NULL, -- Reference to user ID from local app database
    status VARCHAR NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL_FAILED', 'CANCELLED')),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    table_names TEXT[] DEFAULT '{}', -- Array of table names being imported
    total_tables INTEGER DEFAULT 0,
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    results JSONB, -- Per-table results with processedRecords and skippedRecords
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track imported tables metadata - lowercase singular naming
CREATE TABLE IF NOT EXISTS imported_table (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR NOT NULL REFERENCES import_session(id) ON DELETE CASCADE,
    table_name VARCHAR NOT NULL,
    airtable_table_id VARCHAR,
    record_count INTEGER DEFAULT 0,
    status VARCHAR NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL_FAILED', 'CANCELLED')),
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(session_id, table_name)
);

-- Dynamic schema tracking for imported Airtable tables - lowercase singular naming
CREATE TABLE IF NOT EXISTS airtable_schema (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR UNIQUE NOT NULL,
    base_id VARCHAR NOT NULL,
    airtable_id VARCHAR NOT NULL,
    fields JSONB NOT NULL, -- Store field definitions as JSON
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Relationship analysis tables for modular relationship system
CREATE TABLE IF NOT EXISTS relationship_analysis (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR NOT NULL,
    table_name VARCHAR NOT NULL,
    field_name VARCHAR NOT NULL,
    target_table VARCHAR NOT NULL,
    cardinality VARCHAR CHECK (cardinality IN ('one-to-one', 'one-to-many', 'many-to-one', 'many-to-many')),
    confidence_score DECIMAL(3,2) DEFAULT 0.00,
    total_records INTEGER DEFAULT 0,
    non_null_records INTEGER DEFAULT 0,
    unique_values INTEGER DEFAULT 0,
    analysis_data JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(session_id, table_name, field_name)
);

-- Junction table proposals for many-to-many relationships
CREATE TABLE IF NOT EXISTS junction_proposal (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR NOT NULL,
    relationship_id INTEGER REFERENCES relationship_analysis(id) ON DELETE CASCADE,
    junction_table_name VARCHAR NOT NULL,
    source_column VARCHAR NOT NULL,
    target_column VARCHAR NOT NULL,
    is_created BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Foreign key proposals for relationship implementation
CREATE TABLE IF NOT EXISTS foreign_key_proposal (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR NOT NULL,
    relationship_id INTEGER REFERENCES relationship_analysis(id) ON DELETE CASCADE,
    source_table VARCHAR NOT NULL,
    source_column VARCHAR NOT NULL,
    target_table VARCHAR NOT NULL,
    target_column VARCHAR NOT NULL,
    is_created BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration tracking for data database
CREATE TABLE IF NOT EXISTS data_migration (
    id SERIAL PRIMARY KEY,
    version VARCHAR NOT NULL UNIQUE,
    description VARCHAR NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_import_session_user_id ON import_session(user_id);
CREATE INDEX IF NOT EXISTS idx_import_session_status ON import_session(status);
CREATE INDEX IF NOT EXISTS idx_imported_table_session_id ON imported_table(session_id);
CREATE INDEX IF NOT EXISTS idx_airtable_schema_base_id ON airtable_schema(base_id);
CREATE INDEX IF NOT EXISTS idx_relationship_analysis_session_id ON relationship_analysis(session_id);
CREATE INDEX IF NOT EXISTS idx_relationship_analysis_cardinality ON relationship_analysis(cardinality);

-- Enhanced relationship analysis function from previous implementation
CREATE OR REPLACE FUNCTION analyze_relationships()
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
    -- Loop through all tables that have link fields (TEXT[] columns)
    FOR table_record IN 
        SELECT t.table_name
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND EXISTS (
            SELECT 1 
            FROM information_schema.columns c 
            WHERE c.table_name = t.table_name 
            AND c.data_type = 'ARRAY'
        )
    LOOP
        -- Loop through TEXT[] fields in each table
        FOR field_record IN
            SELECT c.column_name
            FROM information_schema.columns c
            WHERE c.table_name = table_record.table_name
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
                    FROM %I 
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

-- Insert initial migration record
INSERT INTO data_migration (version, description) VALUES 
('001_initial_schema', 'Initial data database schema with import tracking and relationship analysis')
ON CONFLICT (version) DO NOTHING;