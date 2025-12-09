-- Table to store import jobs (tracks each import that happens)
CREATE TABLE IF NOT EXISTS contact_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- File Information
    filename VARCHAR(255) NOT NULL,
    file_size_bytes INTEGER,

    -- Import Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    progress_percentage INTEGER DEFAULT 0,

    -- Row Counts
    total_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,

    -- Error Log (stores which rows failed and why)
    error_details JSONB DEFAULT '[]', -- Array of {row_number, error_message}

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- User who initiated import
    created_by UUID NOT NULL REFERENCES users(id),

    UNIQUE(organization_id, filename)
);

-- Table to store field mappings (tells system which file column = which CRM field)
CREATE TABLE IF NOT EXISTS contact_import_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Mapping Name (so users can save and reuse mappings)
    mapping_name VARCHAR(100) NOT NULL,

    -- Mapping Configuration (stored as JSON)
    -- Example: {"first_name": "FirstName", "last_name": "LastName", "email": "Email"}
    field_mapping JSONB NOT NULL,

    -- Duplicate Handling Settings
    -- Options: create_only, create_or_update, update_only
    duplicate_handling VARCHAR(50) NOT NULL DEFAULT 'create_or_update',

    -- Matching Field (what field to match on when checking for duplicates)
    -- Example: "email" or "phone"
    match_field VARCHAR(100) NOT NULL DEFAULT 'email',

    -- Settings
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),

    UNIQUE(organization_id, mapping_name)
);

-- Table to store import records (detailed log of each contact imported)
CREATE TABLE IF NOT EXISTS contact_import_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES contact_imports(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Which contact was created/updated
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

    -- Row number from the import file
    row_number INTEGER NOT NULL,

    -- What action was taken
    action VARCHAR(50) NOT NULL, -- created, updated, skipped, failed

    -- Error message if it failed
    error_message TEXT,

    -- Data that was processed
    imported_data JSONB NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(import_id, row_number)
);

-- Create indexes for better query performance
CREATE INDEX idx_contact_imports_org ON contact_imports(organization_id);
CREATE INDEX idx_contact_imports_status ON contact_imports(status);
CREATE INDEX idx_contact_import_mappings_org ON contact_import_mappings(organization_id);
CREATE INDEX idx_contact_import_records_import ON contact_import_records(import_id);
