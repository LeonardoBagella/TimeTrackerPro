-- Update projects RLS policy to allow both project owners and admins to create projects
DROP POLICY IF EXISTS "Only project owners can create projects in their organization" ON public.projects;

CREATE POLICY "Project owners and admins can create projects in their organization"
ON public.projects
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) 
  AND (has_role(auth.uid(), 'project_owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND (organization_id = get_user_organization(auth.uid()))
);