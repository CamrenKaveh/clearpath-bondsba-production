-- Surety Domain Database Schema
-- Tables for storing analyses, documents, and underwriting results

-- Applications Table
CREATE TABLE IF NOT EXISTS surety_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(255) NOT NULL UNIQUE,
  applicant_name VARCHAR(255),
  business_type VARCHAR(100),
  industry VARCHAR(100),
  status VARCHAR(50) DEFAULT 'new', -- new, in_review, approved, rejected, archived

  -- Analysis Data
  analysis_type VARCHAR(50) DEFAULT 'full', -- full, spreading, wip
  overall_risk_level VARCHAR(50), -- critical, high, moderate, low

  -- Key Metrics (denormalized for quick queries)
  as_allowed_net_income NUMERIC,
  as_allowed_margin_percent NUMERIC,
  total_wip NUMERIC,
  active_contracts INTEGER,
  average_gross_margin NUMERIC,
  total_bond_value NUMERIC,
  bonds_at_risk_percent NUMERIC,

  -- Full Analysis Result (JSON)
  analysis_result JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255),
  notes TEXT
);

-- Analyses Table (for historical tracking)
CREATE TABLE IF NOT EXISTS surety_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES surety_applications(id) ON DELETE CASCADE,
  analysis_version INTEGER DEFAULT 1,

  -- Detailed Results
  spreading_analysis JSONB,
  wip_analysis JSONB,
  underwriting_summary JSONB,

  -- Parsed Data
  normalized_data JSONB,
  raw_data JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  underwriter_name VARCHAR(255),
  underwriter_notes TEXT
);

-- Documents Table (for storage metadata)
CREATE TABLE IF NOT EXISTS surety_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES surety_applications(id) ON DELETE CASCADE,
  document_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(100), -- balance-sheet, income-statement, etc.
  file_size_bytes INTEGER,

  -- Storage Info
  storage_path VARCHAR(512), -- Path in Vercel Blob or S3
  content_hash VARCHAR(64), -- SHA256 for deduplication

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  extracted_at TIMESTAMPTZ,
  extraction_confidence NUMERIC, -- 0-1
  extraction_errors JSONB -- Array of error objects
);

-- Risk Factors Table (for detailed tracking)
CREATE TABLE IF NOT EXISTS surety_risk_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES surety_applications(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES surety_analyses(id) ON DELETE CASCADE,

  -- Risk Details
  source VARCHAR(50), -- spreading, wip, manual
  code VARCHAR(100), -- NEGATIVE_MARGIN, HIGH_CONCENTRATION, etc.
  severity VARCHAR(50), -- critical, high, medium, low
  message TEXT,

  -- Context
  affected_contracts JSONB, -- Array of contract IDs if applicable
  related_metric VARCHAR(100), -- e.g., "as_allowed_net_income", "bond_exposure"

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(255),
  review_notes TEXT,
  is_resolved BOOLEAN DEFAULT FALSE
);

-- Recommendations Table
CREATE TABLE IF NOT EXISTS surety_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES surety_applications(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES surety_analyses(id) ON DELETE CASCADE,

  -- Recommendation
  priority INTEGER DEFAULT 0, -- 0=low, 1=medium, 2=high, 3=critical
  category VARCHAR(50), -- documentation, financial, legal, collateral, etc.
  recommendation TEXT,
  action_required BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_by VARCHAR(255)
);

-- Indexes for common queries
CREATE INDEX idx_surety_applications_status ON surety_applications(status);
CREATE INDEX idx_surety_applications_risk_level ON surety_applications(overall_risk_level);
CREATE INDEX idx_surety_applications_created_at ON surety_applications(created_at DESC);
CREATE INDEX idx_surety_applications_applicant ON surety_applications(applicant_name);
CREATE INDEX idx_surety_applications_created_by ON surety_applications(created_by);

CREATE INDEX idx_surety_analyses_application_id ON surety_analyses(application_id);
CREATE INDEX idx_surety_analyses_created_at ON surety_analyses(created_at DESC);

CREATE INDEX idx_surety_documents_application_id ON surety_documents(application_id);

CREATE INDEX idx_surety_risk_factors_application_id ON surety_risk_factors(application_id);
CREATE INDEX idx_surety_risk_factors_severity ON surety_risk_factors(severity);
CREATE INDEX idx_surety_risk_factors_resolved ON surety_risk_factors(is_resolved);

CREATE INDEX idx_surety_recommendations_application_id ON surety_recommendations(application_id);
CREATE INDEX idx_surety_recommendations_priority ON surety_recommendations(priority);
CREATE INDEX idx_surety_recommendations_completed ON surety_recommendations(completed_at);

-- Enable RLS (Row Level Security) for multi-tenancy
ALTER TABLE surety_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE surety_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE surety_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE surety_risk_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE surety_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can work only with their own application packets.
CREATE POLICY "users_can_view_own_applications"
  ON surety_applications FOR SELECT
  USING (created_by = auth.uid()::text);

CREATE POLICY "users_can_create_applications"
  ON surety_applications FOR INSERT
  WITH CHECK (created_by = auth.uid()::text);

CREATE POLICY "users_can_update_own_applications"
  ON surety_applications FOR UPDATE
  USING (created_by = auth.uid()::text)
  WITH CHECK (created_by = auth.uid()::text);

CREATE POLICY "users_can_view_own_analyses"
  ON surety_analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM surety_applications sa
      WHERE sa.id = surety_analyses.application_id
      AND sa.created_by = auth.uid()::text
    )
  );

CREATE POLICY "users_can_view_own_documents"
  ON surety_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM surety_applications sa
      WHERE sa.id = surety_documents.application_id
      AND sa.created_by = auth.uid()::text
    )
  );

CREATE POLICY "users_can_view_own_risk_factors"
  ON surety_risk_factors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM surety_applications sa
      WHERE sa.id = surety_risk_factors.application_id
      AND sa.created_by = auth.uid()::text
    )
  );

CREATE POLICY "users_can_view_own_recommendations"
  ON surety_recommendations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM surety_applications sa
      WHERE sa.id = surety_recommendations.application_id
      AND sa.created_by = auth.uid()::text
    )
  );
