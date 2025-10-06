-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.projects;

-- Allow all authenticated users to view all projects (needed to see available projects to join)
CREATE POLICY "Authenticated users can view all projects"
ON public.projects
FOR SELECT
TO authenticated
USING (true);