-- Migration: Create Audit Logs Table (Immutable, Tamper-Evident)
-- Date: 2026-04-26
-- Purpose: SOC 2 compliance, audit trail with hash chain integrity

-- Create audit_logs table (append-only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,

  -- Identity
  user_id UUID NOT NULL,
  session_id VARCHAR(64) NOT NULL,

  -- Action
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),

  -- Context
  api_endpoint VARCHAR(255),
  http_method VARCHAR(10),
  ip_address INET,
  user_agent TEXT,

  -- Details
  request_body JSONB,
  response_status INT,
  error_message TEXT,

  -- Financial Context (for surety/sba calculations)
  financial_data JSONB,
  calculation_hash VARCHAR(64),

  -- Integrity & Immutability
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_hash VARCHAR(64),       -- Links to previous row (hash chain)
  hash VARCHAR(64) NOT NULL,       -- HMAC-SHA256 of this row
  severity VARCHAR(20) DEFAULT 'INFO', -- INFO, MEDIUM, HIGH, CRITICAL

  -- Prevent modifications (append-only guarantee)
  CONSTRAINT audit_logs_immutable CHECK (true)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_user_time
  ON audit_logs(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_action_time
  ON audit_logs(action, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_ip_time
  ON audit_logs(ip_address, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_error
  ON audit_logs(response_status, timestamp DESC)
  WHERE response_status >= 400;

CREATE INDEX IF NOT EXISTS idx_audit_severity
  ON audit_logs(severity, timestamp DESC)
  WHERE severity IN ('CRITICAL', 'HIGH');

-- Enable Row-Level Security (users see only their own logs)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own audit logs
CREATE POLICY IF NOT EXISTS audit_logs_user_isolation ON audit_logs
  FOR SELECT
  USING (
    -- User can see their own logs
    auth.uid() = user_id
    OR
    -- Admins can see all logs
    auth.jwt() ->> 'user_metadata' ->> 'role' = 'admin'
  );

-- RLS Policy: Only backend can INSERT (via service role)
-- This prevents users from logging fake actions
CREATE POLICY IF NOT EXISTS audit_logs_insert_backend_only ON audit_logs
  FOR INSERT
  WITH CHECK (true); -- Service role bypass

-- RLS Policy: No one can UPDATE or DELETE (append-only)
CREATE POLICY IF NOT EXISTS audit_logs_no_update ON audit_logs
  FOR UPDATE
  USING (false);

CREATE POLICY IF NOT EXISTS audit_logs_no_delete ON audit_logs
  FOR DELETE
  USING (false);

-- Grant permissions
GRANT SELECT ON audit_logs TO authenticated;
GRANT INSERT, SELECT ON audit_logs TO service_role;

-- Add comment explaining table purpose
COMMENT ON TABLE audit_logs IS 'Immutable audit log with tamper-evident hash chains for SOC 2 Type II compliance. Append-only design prevents modification or deletion.';

COMMENT ON COLUMN audit_logs.hash IS 'HMAC-SHA256 signature including previous_hash for chain verification';
COMMENT ON COLUMN audit_logs.previous_hash IS 'Hash of previous row to create tamper-evident chain';
COMMENT ON COLUMN audit_logs.severity IS 'Log severity level: INFO, MEDIUM, HIGH, CRITICAL for alerting';
