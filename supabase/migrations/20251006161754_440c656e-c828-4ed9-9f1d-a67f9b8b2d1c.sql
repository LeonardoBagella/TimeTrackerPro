-- Add closed_at field to projects
ALTER TABLE public.projects 
ADD COLUMN closed_at TIMESTAMP WITH TIME ZONE;

-- Drop problematic RLS policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view project members of their projects" ON public.project_members;
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.projects;
DROP POLICY IF EXISTS "Users can view time entries for their projects" ON public.time_entries;
DROP POLICY IF EXISTS "Users can create time entries for their projects" ON public.time_entries;

-- Create security definer function to check project membership
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE user_id = _user_id
    AND project_id = _project_id
  )
$$;

-- Update RLS policies using the security definer function
CREATE POLICY "Users can view their project memberships"
ON public.project_members
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can view projects they are members of"
ON public.projects
FOR SELECT
USING (public.is_project_member(auth.uid(), id));

CREATE POLICY "Users can view time entries for their projects"
ON public.time_entries
FOR SELECT
USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Users can create time entries for their projects"
ON public.time_entries
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  public.is_project_member(auth.uid(), project_id)
);