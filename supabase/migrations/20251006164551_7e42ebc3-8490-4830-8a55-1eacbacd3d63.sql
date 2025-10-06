-- Update projects INSERT policy to allow only project_owner role
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;

CREATE POLICY "Only project owners can create projects"
ON public.projects
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  public.has_role(auth.uid(), 'project_owner')
);

-- Assign project_owner role to l.bagella@soluxioni.it
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'project_owner'::app_role
FROM auth.users
WHERE email = 'l.bagella@soluxioni.it'
ON CONFLICT (user_id, role) DO NOTHING;