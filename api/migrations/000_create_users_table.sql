/**
 * Create Users Profile Table
 *
 * This migration creates the base users table that stores user profile information.
 * It includes a trigger to automatically create a user profile when someone signs up via OAuth.
 *
 * Execute this migration in Supabase BEFORE the other migrations:
 * 1. Go to SQL Editor in Supabase Dashboard
 * 2. Copy this entire file
 * 3. Execute
 */

-- Create users table (public schema)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for quick lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own profile
CREATE POLICY users_select_self ON users
  FOR SELECT
  USING (auth.uid() = id);

-- RLS Policy: Users can update their own profile
CREATE POLICY users_update_self ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Function to handle new user signup (create profile + default role)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile
  INSERT INTO users (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  -- Create default underwriter role
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'underwriter')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run when new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Helper function to get user profile
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  email VARCHAR,
  full_name VARCHAR,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.full_name, u.avatar_url, u.created_at
  FROM users u
  WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Summary
/*
 * WHAT THIS MIGRATION DOES:
 *
 * 1. Creates users table with:
 *    - id: UUID (foreign key to auth.users)
 *    - email: User's email
 *    - full_name: User's display name
 *    - avatar_url: Profile picture URL
 *    - created_at, updated_at: Timestamps
 *
 * 2. Creates trigger on auth.users INSERT that:
 *    - Automatically creates a user profile record
 *    - Automatically assigns 'underwriter' default role
 *    - Only runs when new user signs up via OAuth
 *
 * 3. Enables RLS so users can only see their own profile
 *
 * RESULT: When a user signs in with Google, they get:
 * ✅ auth.users record (Supabase handles this)
 * ✅ users profile record (trigger creates this)
 * ✅ user_roles record with 'underwriter' role (trigger creates this)
 * ✅ Full account setup on first login!
 */
