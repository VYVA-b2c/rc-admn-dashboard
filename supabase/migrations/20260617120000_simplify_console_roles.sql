-- Active console roles are platform admin, organization admin, and operator.
-- Platform admin is stored on profiles.is_platform_admin; legacy coordinator rows
-- are folded into operator for now.

UPDATE public.user_roles
SET role = 'operator'
WHERE role::text = 'coordinator';
