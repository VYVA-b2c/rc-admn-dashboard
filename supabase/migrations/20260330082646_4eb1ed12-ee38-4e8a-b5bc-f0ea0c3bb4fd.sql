-- Add SELECT policy on profiles for users to read their own profile
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add SELECT policy on sensor_type_catalog for all authenticated users
CREATE POLICY "Authenticated users can read sensor catalog"
ON public.sensor_type_catalog
FOR SELECT
TO authenticated
USING (true);