-- Create analyze_relationships function for cardinality analysis
-- Purpose: Analyze relationship cardinality (one-to-one, one-to-many, many-to-one, many-to-many)

CREATE OR REPLACE FUNCTION analyze_relationships(relations jsonb)
RETURNS TABLE (
    from_table text,
    from_field text,
    to_table text,
    relationship_type text,
    max_links_from bigint,
    max_links_to bigint,
    error_message text
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- A variable to hold each relationship object from the JSON array
    rel_obj jsonb;
    -- Variables to hold the parameters for each relationship
    v_from_table text;
    v_from_field text;
    v_field_type text;
    -- Variables to hold the dynamic query strings
    sql_from_side text;
    sql_to_side text;
    -- Variables to store the results of the dynamic queries
    max_from bigint;
    max_to bigint;
BEGIN
    -- Loop through each JSON object in the input array
    FOR rel_obj IN SELECT * FROM jsonb_array_elements(relations)
    LOOP
        -- Extract parameters from the JSON object
        v_from_table := rel_obj->>'fromTable';
        v_from_field := rel_obj->>'fromField';
        v_field_type := rel_obj->>'fieldType'; -- e.g., 'array' or 'scalar'

        -- Reset counts for each loop
        max_from := 0;
        max_to   := 0;

        BEGIN
            -- Build the queries based on whether the field is an array or a standard foreign key
            IF v_field_type = 'array' THEN
                -- Query for array type
                sql_from_side := format('SELECT COALESCE(MAX(cardinality(%I)), 0) FROM %I WHERE %I IS NOT NULL', v_from_field, v_from_table, v_from_field);
                sql_to_side   := format('SELECT COALESCE(MAX(ref_count), 0) FROM (SELECT COUNT(*) AS ref_count FROM %I, unnest(%I) AS ref_id WHERE %I IS NOT NULL GROUP BY ref_id) AS counts', v_from_table, v_from_field, v_from_field);

                EXECUTE sql_from_side INTO max_from;
                EXECUTE sql_to_side INTO max_to;

            ELSE -- Assume it's a scalar (standard) foreign key
                -- For a standard key, a 'from' row can only link to one 'to' row. So the "from" side is always 1.
                max_from := 1;
                -- The "to" side query counts how many times each key is used in the 'from' table.
                sql_to_side := format('SELECT COALESCE(MAX(ref_count), 0) FROM (SELECT COUNT(*) AS ref_count FROM %I WHERE %I IS NOT NULL GROUP BY %I) AS counts', v_from_table, v_from_field, v_from_field);

                EXECUTE sql_to_side INTO max_to;
            END IF;

            -- Set the output values for this relationship
            from_table        := v_from_table;
            from_field        := v_from_field;
            to_table          := rel_obj->>'toTable'; -- Get this for the output
            max_links_from    := COALESCE(max_from, 0);
            max_links_to      := COALESCE(max_to, 0);
            relationship_type := CONCAT(
                                    CASE WHEN COALESCE(max_from, 0) > 1 THEN 'many' ELSE 'one' END,
                                    '-to-',
                                    CASE WHEN COALESCE(max_to, 0) > 1 THEN 'many' ELSE 'one' END
                                );
            error_message     := NULL;

        EXCEPTION WHEN others THEN
            -- If any query fails (e.g., table/column not found), catch the error
            from_table        := v_from_table;
            from_field        := v_from_field;
            to_table          := rel_obj->>'toTable';
            max_links_from    := 0;
            max_links_to      := 0;
            relationship_type := 'error';
            error_message     := SQLERRM; -- SQLERRM is the PostgreSQL variable for the error message
        END;

        -- Add the result for this relationship to the output table
        RETURN NEXT;
    END LOOP;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION analyze_relationships(jsonb) IS 'Analyzes relationship cardinality between tables using array or scalar fields. Returns one-to-one, one-to-many, many-to-one, or many-to-many relationship types with actual cardinality counts.';