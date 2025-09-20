-- CSV Import System Database Schema
-- This schema supports importing leads and contacts with tracking and error handling

-- Import Jobs Table
-- Tracks each import operation with metadata and status
CREATE TABLE IF NOT EXISTS import_jobs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Import metadata
    import_type VARCHAR(50) NOT NULL CHECK (import_type IN ('leads', 'contacts')),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_size INTEGER,

    -- Processing status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

    -- Field mapping (JSON object storing CSV column to DB field mappings)
    field_mapping JSONB,

    -- Import options
    import_options JSONB DEFAULT '{
        "skip_duplicates": true,
        "update_existing": false,
        "validate_emails": true,
        "batch_size": 1000
    }'::jsonb,

    -- Processing statistics
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    duplicate_rows INTEGER DEFAULT 0,

    -- Timing information
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Error information
    error_message TEXT,
    error_details JSONB,

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Import Errors Table
-- Stores detailed error information for each failed row
CREATE TABLE IF NOT EXISTS import_errors (
    id SERIAL PRIMARY KEY,
    import_job_id INTEGER NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,

    -- Row information
    row_number INTEGER NOT NULL,
    row_data JSONB NOT NULL,

    -- Error details
    error_type VARCHAR(100) NOT NULL, -- 'validation', 'duplicate', 'processing', 'database'
    error_field VARCHAR(100), -- specific field that caused the error
    error_message TEXT NOT NULL,
    error_code VARCHAR(50),

    -- Severity level
    severity VARCHAR(20) DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'critical')),

    -- Additional context
    suggested_fix TEXT,
    error_context JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Import Field Mappings Table (Optional: for saving commonly used mappings)
CREATE TABLE IF NOT EXISTS import_field_mappings (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL, -- User-friendly name for the mapping
    import_type VARCHAR(50) NOT NULL CHECK (import_type IN ('leads', 'contacts')),

    -- The actual field mapping
    field_mapping JSONB NOT NULL,

    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique mapping names per organization and type
    UNIQUE(organization_id, import_type, name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_import_jobs_org_id ON import_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_type ON import_jobs(import_type);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_import_errors_job_id ON import_errors(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_errors_type ON import_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_import_errors_severity ON import_errors(severity);

CREATE INDEX IF NOT EXISTS idx_import_field_mappings_org_type ON import_field_mappings(organization_id, import_type);

-- RLS (Row Level Security) Policies
-- Enable RLS on all import tables
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_field_mappings ENABLE ROW LEVEL SECURITY;

-- Import Jobs RLS Policies
CREATE POLICY import_jobs_org_isolation ON import_jobs
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::INTEGER);

-- Import Errors RLS Policies (through import_jobs relationship)
CREATE POLICY import_errors_org_isolation ON import_errors
    FOR ALL
    USING (
        import_job_id IN (
            SELECT id FROM import_jobs
            WHERE organization_id = current_setting('app.current_organization_id')::INTEGER
        )
    );

-- Import Field Mappings RLS Policies
CREATE POLICY import_field_mappings_org_isolation ON import_field_mappings
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::INTEGER);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_import_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_import_jobs_updated_at
    BEFORE UPDATE ON import_jobs
    FOR EACH ROW EXECUTE FUNCTION update_import_updated_at();

CREATE TRIGGER update_import_field_mappings_updated_at
    BEFORE UPDATE ON import_field_mappings
    FOR EACH ROW EXECUTE FUNCTION update_import_updated_at();

-- Function to clean up old import files and data
CREATE OR REPLACE FUNCTION cleanup_old_import_data()
RETURNS void AS $$
BEGIN
    -- Delete import jobs older than 90 days (configurable)
    DELETE FROM import_jobs
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
    AND status IN ('completed', 'failed', 'cancelled');

    -- The cascade will automatically clean up related import_errors
END;
$$ language 'plpgsql';

-- Optional: Create a scheduled job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-imports', '0 2 * * 0', 'SELECT cleanup_old_import_data();');