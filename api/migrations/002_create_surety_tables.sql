/**
 * Phase 1 Surety Domain Database Schema
 *
 * Creates tables for:
 * - surety_applications: Core application data
 * - surety_analyses: Analysis results (spreading, WIP)
 * - surety_documents: Document metadata
 * - surety_risk_factors: Identified risk factors
 * - surety_recommendations: Underwriting recommendations
 *
 * Execute this migration in Supabase:
 * 1. Go to SQL Editor in Supabase Dashboard
 * 2. Copy this entire file
 * 3. Execute
 */

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create surety_applications table
CREATE TABLE IF NOT EXISTS surety_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,
  document_id VARCHAR(255),
  applicant_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(100),
  industry VARCHAR(100),
  analysis_type VARCHAR(50) DEFAULT 'full',
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'approved', 'rejected', 'archived')),
  overall_risk_level VARCHAR(50) CHECK (overall_risk_level IN ('critical', 'high', 'moderate', 'low', 'pending')),

  -- Key metrics snapshot (denormalized for query performance)
  as_allowed_net_income NUMERIC,
  as_allowed_margin_percent NUMERIC,
  total_wip NUMERIC,
  active_contracts INTEGER,
  average_gross_margin NUMERIC,
  total_bond_value NUMERIC,
  bonds_at_risk_percent NUMERIC,

  -- Full analysis result stored as JSONB for flexibility
  analysis_result JSONB,
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create surety_analyses table
CREATE TABLE IF NOT EXISTS surety_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES surety_applications(id) ON DELETE CASCADE,

  -- Structured analysis components
  spreading_analysis JSONB,
  wip_analysis JSONB,
  underwriting_summary JSONB,

  -- Original parsed data for audit trail
  normalized_data JSONB,
  raw_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create surety_documents table
CREATE TABLE IF NOT EXISTS surety_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES surety_applications(id) ON DELETE CASCADE,
  document_name VARCHAR(500),
  document_type VARCHAR(100),
  extraction_confidence NUMERIC DEFAULT 0.75,
  extracted_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create surety_risk_factors table
CREATE TABLE IF NOT EXISTS surety_risk_factors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES surety_applications(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES surety_analyses(id) ON DELETE SET NULL,

  source VARCHAR(100),
  code VARCHAR(50),
  severity VARCHAR(50) CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  message TEXT,
  affected_contracts JSONB,

  -- Resolution tracking
  is_resolved BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(255),
  review_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create surety_recommendations table
CREATE TABLE IF NOT EXISTS surety_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES surety_applications(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES surety_analyses(id) ON DELETE SET NULL,

  priority INTEGER DEFAULT 0,
  recommendation TEXT,

  -- Completion tracking
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by VARCHAR(255),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_surety_apps_user_id ON surety_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_surety_apps_org_id ON surety_applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_surety_apps_status ON surety_applications(status);
CREATE INDEX IF NOT EXISTS idx_surety_apps_risk_level ON surety_applications(overall_risk_level);
CREATE INDEX IF NOT EXISTS idx_surety_apps_created_at ON surety_applications(created_at);

CREATE INDEX IF NOT EXISTS idx_surety_analyses_app_id ON surety_analyses(application_id);
CREATE INDEX IF NOT EXISTS idx_surety_docs_app_id ON surety_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_surety_risks_app_id ON surety_risk_factors(application_id);
CREATE INDEX IF NOT EXISTS idx_surety_risks_severity ON surety_risk_factors(severity);
CREATE INDEX IF NOT EXISTS idx_surety_recs_app_id ON surety_recommendations(application_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_surety_apps_updated_at
  BEFORE UPDATE ON surety_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_surety_analyses_updated_at
  BEFORE UPDATE ON surety_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE surety_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE surety_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE surety_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE surety_risk_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE surety_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view/edit their own applications
CREATE POLICY surety_apps_user_isolation ON surety_applications
  FOR ALL
  USING (auth.uid() = user_id OR
         EXISTS (
           SELECT 1 FROM user_roles
           WHERE user_id = auth.uid() AND role = 'admin'
         ));

CREATE POLICY surety_analyses_user_isolation ON surety_analyses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM surety_applications sa
      WHERE sa.id = surety_analyses.application_id
      AND (sa.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM user_roles
             WHERE user_id = auth.uid() AND role = 'admin'
           ))
    )
  );

CREATE POLICY surety_docs_user_isolation ON surety_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM surety_applications sa
      WHERE sa.id = surety_documents.application_id
      AND (sa.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM user_roles
             WHERE user_id = auth.uid() AND role = 'admin'
           ))
    )
  );

CREATE POLICY surety_risks_user_isolation ON surety_risk_factors
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM surety_applications sa
      WHERE sa.id = surety_risk_factors.application_id
      AND (sa.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM user_roles
             WHERE user_id = auth.uid() AND role = 'admin'
           ))
    )
  );

CREATE POLICY surety_recs_user_isolation ON surety_recommendations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM surety_applications sa
      WHERE sa.id = surety_recommendations.application_id
      AND (sa.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM user_roles
             WHERE user_id = auth.uid() AND role = 'admin'
           ))
    )
  );
