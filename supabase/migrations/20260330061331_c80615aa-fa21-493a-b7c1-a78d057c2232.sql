
-- Admin UPDATE on vyva_users
CREATE POLICY "Admins can update vyva_users" ON public.vyva_users FOR UPDATE TO authenticated USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));

-- Admin INSERT, UPDATE, DELETE on vyva_user_medications
CREATE POLICY "Admins can insert vyva_user_medications" ON public.vyva_user_medications FOR INSERT TO authenticated WITH CHECK (is_admin_user(auth.uid()));
CREATE POLICY "Admins can update vyva_user_medications" ON public.vyva_user_medications FOR UPDATE TO authenticated USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));
CREATE POLICY "Admins can delete vyva_user_medications" ON public.vyva_user_medications FOR DELETE TO authenticated USING (is_admin_user(auth.uid()));

-- Admin INSERT, UPDATE, DELETE on vyva_user_caregivers
CREATE POLICY "Admins can insert vyva_user_caregivers" ON public.vyva_user_caregivers FOR INSERT TO authenticated WITH CHECK (is_admin_user(auth.uid()));
CREATE POLICY "Admins can update vyva_user_caregivers" ON public.vyva_user_caregivers FOR UPDATE TO authenticated USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));
CREATE POLICY "Admins can delete vyva_user_caregivers" ON public.vyva_user_caregivers FOR DELETE TO authenticated USING (is_admin_user(auth.uid()));

-- Admin UPDATE on vyva_user_checkins
CREATE POLICY "Admins can update vyva_user_checkins" ON public.vyva_user_checkins FOR UPDATE TO authenticated USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));

-- Admin UPDATE on vyva_user_brain_coach
CREATE POLICY "Admins can update vyva_user_brain_coach" ON public.vyva_user_brain_coach FOR UPDATE TO authenticated USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));

-- Admin UPDATE on vyva_user_health
CREATE POLICY "Admins can update vyva_user_health" ON public.vyva_user_health FOR UPDATE TO authenticated USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));
