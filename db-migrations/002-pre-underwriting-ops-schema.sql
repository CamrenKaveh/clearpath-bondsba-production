-- Migration: Pre-underwriting operating schema (organization scoped)
-- Date: 2026-05-17
-- Purpose: add contractor readiness, WIP intelligence, handoff workflow tables with strict org-scoped RLS

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared updated_at helper
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Organization core
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

-- Contractor operational memory
CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade_type TEXT,
  location TEXT,
  status TEXT DEFAULT 'active',
  overview TEXT,
  ownership_notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contractor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Submission workspace
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_preparation',
  readiness_score INTEGER,
  wip_quality_score INTEGER,
  operational_risk_level TEXT,
  lender_handoff_status TEXT DEFAULT 'not_started',
  surety_handoff_status TEXT DEFAULT 'not_started',
  assigned_to UUID,
  next_action TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submission_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'missing',
  is_stale BOOLEAN NOT NULL DEFAULT FALSE,
  received_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WIP intelligence + readiness artifacts
CREATE TABLE IF NOT EXISTS wip_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  wip_quality_score INTEGER,
  operational_risk_score INTEGER,
  margin_fade_status TEXT,
  underbilling_status TEXT,
  overbilling_status TEXT,
  backlog_concentration_status TEXT,
  capacity_stress_status TEXT,
  profitability_trend TEXT,
  data_quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  underwriter_summary TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS readiness_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  readiness_score INTEGER,
  lender_ready_status TEXT,
  surety_ready_status TEXT,
  critical_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  important_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_next_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow coordination + memo outputs
CREATE TABLE IF NOT EXISTS workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES contractors(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to UUID,
  due_date DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handoff_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  memo_type TEXT NOT NULL DEFAULT 'lender_handoff',
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for daily workflow reads
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_contractors_org ON contractors(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_org ON submissions(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_submission_documents_org ON submission_documents(organization_id, submission_id);
CREATE INDEX IF NOT EXISTS idx_wip_analyses_org ON wip_analyses(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_readiness_checks_org ON readiness_checks(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_org ON workflow_tasks(organization_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_handoff_memos_org ON handoff_memos(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_org ON audit_events(organization_id, created_at DESC);

-- updated_at triggers
CREATE TRIGGER trg_org_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
CREATE TRIGGER trg_contractors_updated_at BEFORE UPDATE ON contractors FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
CREATE TRIGGER trg_contractor_contacts_updated_at BEFORE UPDATE ON contractor_contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
CREATE TRIGGER trg_submissions_updated_at BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
CREATE TRIGGER trg_submission_documents_updated_at BEFORE UPDATE ON submission_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
CREATE TRIGGER trg_wip_analyses_updated_at BEFORE UPDATE ON wip_analyses FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
CREATE TRIGGER trg_readiness_checks_updated_at BEFORE UPDATE ON readiness_checks FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
CREATE TRIGGER trg_workflow_tasks_updated_at BEFORE UPDATE ON workflow_tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
CREATE TRIGGER trg_handoff_memos_updated_at BEFORE UPDATE ON handoff_memos FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- Helper: current user's organizations
CREATE OR REPLACE FUNCTION current_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid();
$$;

-- RLS enable
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE wip_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoff_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- organizations
CREATE POLICY organizations_select_policy
  ON organizations FOR SELECT
  USING (id IN (SELECT * FROM current_user_org_ids()));

CREATE POLICY organizations_update_policy
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- organization_members
CREATE POLICY org_members_select_policy
  ON organization_members FOR SELECT
  USING (organization_id IN (SELECT * FROM current_user_org_ids()));

CREATE POLICY org_members_insert_policy
  ON organization_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Generic organization-scoped policies
CREATE POLICY contractors_select_policy
  ON contractors FOR SELECT
  USING (organization_id IN (SELECT * FROM current_user_org_ids()));
CREATE POLICY contractors_insert_policy
  ON contractors FOR INSERT
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()) AND created_by = auth.uid());
CREATE POLICY contractors_update_policy
  ON contractors FOR UPDATE
  USING (organization_id IN (SELECT * FROM current_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()));

CREATE POLICY contractor_contacts_select_policy
  ON contractor_contacts FOR SELECT
  USING (organization_id IN (SELECT * FROM current_user_org_ids()));
CREATE POLICY contractor_contacts_insert_policy
  ON contractor_contacts FOR INSERT
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()));
CREATE POLICY contractor_contacts_update_policy
  ON contractor_contacts FOR UPDATE
  USING (organization_id IN (SELECT * FROM current_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()));

CREATE POLICY submissions_select_policy
  ON submissions FOR SELECT
  USING (organization_id IN (SELECT * FROM current_user_org_ids()));
CREATE POLICY submissions_insert_policy
  ON submissions FOR INSERT
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()) AND created_by = auth.uid());
CREATE POLICY submissions_update_policy
  ON submissions FOR UPDATE
  USING (organization_id IN (SELECT * FROM current_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()));

CREATE POLICY submission_documents_select_policy
  ON submission_documents FOR SELECT
  USING (organization_id IN (SELECT * FROM current_user_org_ids()));
CREATE POLICY submission_documents_insert_policy
  ON submission_documents FOR INSERT
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()));
CREATE POLICY submission_documents_update_policy
  ON submission_documents FOR UPDATE
  USING (organization_id IN (SELECT * FROM current_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()));

CREATE POLICY wip_analyses_select_policy
  ON wip_analyses FOR SELECT
  USING (organization_id IN (SELECT * FROM current_user_org_ids()));
CREATE POLICY wip_analyses_insert_policy
  ON wip_analyses FOR INSERT
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()) AND created_by = auth.uid());
CREATE POLICY wip_analyses_update_policy
  ON wip_analyses FOR UPDATE
  USING (organization_id IN (SELECT * FROM current_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()));

CREATE POLICY readiness_checks_select_policy
  ON readiness_checks FOR SELECT
  USING (organization_id IN (SELECT * FROM current_user_org_ids()));
CREATE POLICY readiness_checks_insert_policy
  ON readiness_checks FOR INSERT
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()) AND created_by = auth.uid());
CREATE POLICY readiness_checks_update_policy
  ON readiness_checks FOR UPDATE
  USING (organization_id IN (SELECT * FROM current_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()));

CREATE POLICY workflow_tasks_select_policy
  ON workflow_tasks FOR SELECT
  USING (organization_id IN (SELECT * FROM current_user_org_ids()));
CREATE POLICY workflow_tasks_insert_policy
  ON workflow_tasks FOR INSERT
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()) AND created_by = auth.uid());
CREATE POLICY workflow_tasks_update_policy
  ON workflow_tasks FOR UPDATE
  USING (organization_id IN (SELECT * FROM current_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()));

CREATE POLICY handoff_memos_select_policy
  ON handoff_memos FOR SELECT
  USING (organization_id IN (SELECT * FROM current_user_org_ids()));
CREATE POLICY handoff_memos_insert_policy
  ON handoff_memos FOR INSERT
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()) AND created_by = auth.uid());
CREATE POLICY handoff_memos_update_policy
  ON handoff_memos FOR UPDATE
  USING (organization_id IN (SELECT * FROM current_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT * FROM current_user_org_ids()));

CREATE POLICY audit_events_select_policy
  ON audit_events FOR SELECT
  USING (organization_id IN (SELECT * FROM current_user_org_ids()));
CREATE POLICY audit_events_insert_policy
  ON audit_events FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT * FROM current_user_org_ids())
    AND actor_id = auth.uid()
  );
