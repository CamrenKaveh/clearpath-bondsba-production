/**
 * Phase 1 SBA Loans Domain Database Schema
 *
 * Creates tables for:
 * - sba_loans: Core loan applications
 * - sba_documents: Financial document metadata
 * - sba_analyses: Loan analysis results (DSCR, affordability, etc.)
 * - sba_amortization_schedules: Monthly payment schedules
 * - sba_term_sheets: Generated term sheet records
 *
 * Execute this migration in Supabase:
 * 1. Go to SQL Editor in Supabase Dashboard
 * 2. Copy this entire file
 * 3. Execute
 */

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create sba_loans table
CREATE TABLE IF NOT EXISTS sba_loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,

  -- Basic loan info
  loan_number VARCHAR(100),
  borrower_name VARCHAR(255) NOT NULL,
  business_name VARCHAR(255),

  -- Loan parameters
  requested_amount NUMERIC NOT NULL,
  program VARCHAR(50) DEFAULT '7(a)' CHECK (program IN ('7(a)', '504', 'Express')),
  purpose VARCHAR(255),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'declined', 'closed', 'archived')),

  -- Key financial metrics (snapshot for performance)
  monthly_debt_service NUMERIC,
  annual_debt_service NUMERIC,
  dscr_ratio NUMERIC,
  required_equity_percent NUMERIC,
  required_equity_amount NUMERIC,

  -- Analysis results
  analysis_complete BOOLEAN DEFAULT FALSE,
  term_sheet_generated BOOLEAN DEFAULT FALSE,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create sba_documents table (financial documents uploaded for analysis)
CREATE TABLE IF NOT EXISTS sba_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES sba_loans(id) ON DELETE CASCADE,

  document_name VARCHAR(500) NOT NULL,
  document_type VARCHAR(100) NOT NULL, -- 'income-statement', 'balance-sheet', 'tax-return', etc.
  file_format VARCHAR(20), -- 'pdf', 'image', 'csv', etc.

  -- Extraction metadata
  extracted_at TIMESTAMP WITH TIME ZONE,
  extraction_confidence NUMERIC DEFAULT 0.75,
  extraction_errors JSONB, -- Array of extraction warnings/errors

  -- Parsed content (stored for audit trail)
  raw_extracted_data JSONB,
  normalized_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create sba_analyses table
CREATE TABLE IF NOT EXISTS sba_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES sba_loans(id) ON DELETE CASCADE,

  -- Income statement analysis
  revenue NUMERIC,
  expenses NUMERIC,
  ebitda NUMERIC,
  net_income NUMERIC,

  -- Balance sheet analysis
  total_assets NUMERIC,
  total_liabilities NUMERIC,
  owner_equity NUMERIC,
  working_capital NUMERIC,

  -- Financial ratios
  debt_to_equity NUMERIC,
  current_ratio NUMERIC,
  quick_ratio NUMERIC,
  profit_margin NUMERIC,

  -- Underwriting assessment
  strength_summary TEXT, -- Qualitative assessment
  risk_flags JSONB, -- Array of concerns identified

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create sba_amortization_schedules table
CREATE TABLE IF NOT EXISTS sba_amortization_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES sba_loans(id) ON DELETE CASCADE,

  -- Loan terms
  principal_amount NUMERIC NOT NULL,
  annual_interest_rate NUMERIC NOT NULL,
  loan_term_years INTEGER NOT NULL,
  start_date DATE,

  -- Schedule data (stored as JSONB array for flexibility)
  -- Each entry: { month, payment, principal, interest, balance }
  schedule_data JSONB NOT NULL,

  -- Summary metrics
  total_interest NUMERIC,
  total_payments NUMERIC,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create sba_term_sheets table
CREATE TABLE IF NOT EXISTS sba_term_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES sba_loans(id) ON DELETE CASCADE,

  -- Term sheet content
  title VARCHAR(500),
  borrower_name VARCHAR(255),
  lender_name VARCHAR(255),
  effective_date DATE,
  maturity_date DATE,

  -- Structured data for professional rendering
  facility_summary JSONB, -- { amount, rate, term, margin, index, fees }
  covenants JSONB, -- { dscr_min, current_ratio_min, debt_ratio_max, etc. }
  collateral_summary JSONB,

  -- Narrative sections
  underwriting_narrative TEXT,
  conditions_and_terms TEXT,

  -- Generated documents
  html_content TEXT, -- Full HTML for PDF/print
  pdf_url VARCHAR(500), -- URL to stored PDF (if applicable)

  -- Status
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'approved', 'executed')),
  generated_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sba_loans_user_id ON sba_loans(user_id);
CREATE INDEX IF NOT EXISTS idx_sba_loans_org_id ON sba_loans(organization_id);
CREATE INDEX IF NOT EXISTS idx_sba_loans_status ON sba_loans(status);
CREATE INDEX IF NOT EXISTS idx_sba_loans_created_at ON sba_loans(created_at);

CREATE INDEX IF NOT EXISTS idx_sba_docs_loan_id ON sba_documents(loan_id);
CREATE INDEX IF NOT EXISTS idx_sba_docs_type ON sba_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_sba_analyses_loan_id ON sba_analyses(loan_id);

CREATE INDEX IF NOT EXISTS idx_sba_amort_loan_id ON sba_amortization_schedules(loan_id);

CREATE INDEX IF NOT EXISTS idx_sba_terms_loan_id ON sba_term_sheets(loan_id);
CREATE INDEX IF NOT EXISTS idx_sba_terms_status ON sba_term_sheets(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_sba_loans_updated_at
  BEFORE UPDATE ON sba_loans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sba_analyses_updated_at
  BEFORE UPDATE ON sba_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sba_terms_updated_at
  BEFORE UPDATE ON sba_term_sheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE sba_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sba_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sba_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sba_amortization_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sba_term_sheets ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view/edit their own loans
CREATE POLICY sba_loans_user_isolation ON sba_loans
  FOR ALL
  USING (auth.uid() = user_id OR
         EXISTS (
           SELECT 1 FROM user_roles
           WHERE user_id = auth.uid() AND role = 'admin'
         ));

CREATE POLICY sba_docs_user_isolation ON sba_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sba_loans sl
      WHERE sl.id = sba_documents.loan_id
      AND (sl.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM user_roles
             WHERE user_id = auth.uid() AND role = 'admin'
           ))
    )
  );

CREATE POLICY sba_analyses_user_isolation ON sba_analyses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sba_loans sl
      WHERE sl.id = sba_analyses.loan_id
      AND (sl.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM user_roles
             WHERE user_id = auth.uid() AND role = 'admin'
           ))
    )
  );

CREATE POLICY sba_amort_user_isolation ON sba_amortization_schedules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sba_loans sl
      WHERE sl.id = sba_amortization_schedules.loan_id
      AND (sl.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM user_roles
             WHERE user_id = auth.uid() AND role = 'admin'
           ))
    )
  );

CREATE POLICY sba_terms_user_isolation ON sba_term_sheets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sba_loans sl
      WHERE sl.id = sba_term_sheets.loan_id
      AND (sl.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM user_roles
             WHERE user_id = auth.uid() AND role = 'admin'
           ))
    )
  );
