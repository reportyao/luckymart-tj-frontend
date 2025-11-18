-- Add preferred_language column to profiles table
ALTER TABLE public.profiles
ADD COLUMN preferred_language text DEFAULT 'zh'::text;

-- Add has_seen_onboarding column to profiles table
ALTER TABLE public.profiles
ADD COLUMN has_seen_onboarding boolean DEFAULT false;

-- Create RLS policy to allow users to update their own language and onboarding status.
-- Assuming RLS is enabled on the profiles table.
-- This policy allows users to update their own profile, which is necessary for the frontend logic.
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile."
ON public.profiles
FOR UPDATE USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- If a more restrictive policy is needed for these specific columns:
-- DROP POLICY IF EXISTS "Users can update their own language and onboarding status." ON public.profiles;
-- CREATE POLICY "Users can update their own language and onboarding status."
-- ON public.profiles
-- FOR UPDATE (preferred_language, has_seen_onboarding) USING (auth.uid() = id)
-- WITH CHECK (auth.uid() = id);
