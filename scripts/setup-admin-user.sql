-- Setup First Admin User
-- REPLACE 'your-email@example.com' with your actual email

INSERT INTO user_roles (user_id, role, organization_id)
SELECT id, 'admin', null
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Verify the insert worked
SELECT id, email, (
  SELECT role FROM user_roles WHERE user_id = auth.users.id
) as assigned_role
FROM auth.users
WHERE email = 'your-email@example.com';
