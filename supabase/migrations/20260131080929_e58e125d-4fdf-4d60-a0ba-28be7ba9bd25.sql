-- Fix 1: Update project_members INSERT policy to validate organization membership
DROP POLICY IF EXISTS "Users can join projects themselves" ON public.project_members;

CREATE POLICY "Users can join projects in their organization"
ON public.project_members
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_members.project_id
    AND p.organization_id = get_user_organization(auth.uid())
  )
);

-- Fix 2: Update profiles UPDATE policy to prevent organization_id modification
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  (organization_id IS NULL OR organization_id = (
    SELECT p.organization_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ))
);