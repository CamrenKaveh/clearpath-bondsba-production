/**
 * Phase 1 Authentication Database Schema
 *
 * Creates user_roles and role_permissions tables for role-based access control (RBAC).
 *
 * Roles Hierarchy:
 * - admin: Full access to all features and user management
 * - underwriter: Can upload documents, run analyses, generate reports
 * - viewer: Can only view generated reports (read-only)
 *
 * Execute this migration in Supabase:
 * 1. Go to SQL Editor in Supabase Dashboard
 * 2. Copy this entire file
 * 3. Execute
 */

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'underwriter', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(50) NOT NULL UNIQUE CHECK (role IN ('admin', 'underwriter', 'viewer')),
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_logs table for Phase 1C
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default role permissions
INSERT INTO role_permissions (role, permissions) VALUES
  (
    'admin',
    '["users:create", "users:read", "users:update", "users:delete", "roles:manage", "documents:upload", "documents:read", "documents:delete", "analysis:run", "analysis:read", "reports:generate", "reports:read", "audit:read"]'::jsonb
  ),
  (
    'underwriter',
    '["documents:upload", "documents:read", "analysis:run", "analysis:read", "reports:generate", "reports:read"]'::jsonb
  ),
  (
    'viewer',
    '["documents:read", "reports:read"]'::jsonb
  )
ON CONFLICT (role) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security) for user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own role
CREATE POLICY user_roles_select_self ON user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Admins can view all user roles
CREATE POLICY user_roles_select_admin ON user_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- RLS Policy: Only admins can insert/update/delete user roles
CREATE POLICY user_roles_insert_admin ON user_roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY user_roles_update_admin ON user_roles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY user_roles_delete_admin ON user_roles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_role VARCHAR(50);
BEGIN
  SELECT role INTO v_role FROM user_roles WHERE user_id = p_user_id;
  RETURN COALESCE(v_role, 'viewer');
END;
$$ LANGUAGE plpgsql;

-- Helper function to check permission
CREATE OR REPLACE FUNCTION has_permission(p_user_id UUID, p_permission VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR(50);
  v_permissions JSONB;
BEGIN
  -- Get user role
  v_role := get_user_role(p_user_id);

  -- Get role permissions
  SELECT permissions INTO v_permissions FROM role_permissions WHERE role = v_role;

  -- Check if permission exists in the permissions array
  RETURN CASE
    WHEN v_permissions IS NULL THEN FALSE
    WHEN v_permissions @> to_jsonb(ARRAY[p_permission]) THEN TRUE
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql;

-- Summary
/*
 * SCHEMA SUMMARY:
 *
 * Tables:
 * 1. user_roles
 *    - id: UUID primary key
 *    - user_id: Foreign key to auth.users
 *    - organization_id: For multi-org support (Phase 2)
 *    - role: 'admin' | 'underwriter' | 'viewer'
 *    - created_at, updated_at: Timestamps
 *
 * 2. role_permissions
 *    - id: UUID primary key
 *    - role: Role name (unique)
 *    - permissions: JSONB array of permission strings
 *    - created_at, updated_at: Timestamps
 *
 * 3. audit_logs
 *    - id: UUID primary key
 *    - user_id: Foreign key to auth.users
 *    - action: What action was performed
 *    - resource_type: Type of resource (document, analysis, report, etc.)
 *    - resource_id: ID of the resource
 *    - details: JSONB for additional context
 *    - ip_address: IP address of requester
 *    - created_at: Timestamp of action
 *
 * RLS Policies:
 * - Users can view their own role
 * - Admins can view all roles
 * - Only admins can create/update/delete roles
 *
 * Helper Functions:
 * - get_user_role(user_id): Returns user's role or 'viewer' default
 * - has_permission(user_id, permission): Checks if user has permission
 */
