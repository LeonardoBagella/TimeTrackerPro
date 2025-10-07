-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Add organization_id to profiles
ALTER TABLE public.profiles 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add organization_id to projects
ALTER TABLE public.projects 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX idx_projects_organization_id ON public.projects(organization_id);

-- Create function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE user_id = _user_id
$$;

-- RLS Policies for organizations
CREATE POLICY "Users can view their own organization"
ON public.organizations
FOR SELECT
USING (id = public.get_user_organization(auth.uid()));

CREATE POLICY "Admins can view all organizations"
ON public.organizations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update profiles RLS policies to filter by organization
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles
FOR SELECT
USING (
  organization_id = public.get_user_organization(auth.uid()) 
  OR auth.uid() = user_id
);

-- Update projects RLS policies to filter by organization
DROP POLICY IF EXISTS "Authenticated users can view all projects" ON public.projects;
CREATE POLICY "Users can view projects in their organization"
ON public.projects
FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

DROP POLICY IF EXISTS "Only project owners can create projects" ON public.projects;
CREATE POLICY "Only project owners can create projects in their organization"
ON public.projects
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND has_role(auth.uid(), 'project_owner'::app_role)
  AND organization_id = public.get_user_organization(auth.uid())
);

-- Update time_entries RLS policies
DROP POLICY IF EXISTS "Users can view time entries for their projects" ON public.time_entries;
CREATE POLICY "Users can view time entries in their organization"
ON public.time_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = time_entries.project_id
    AND p.organization_id = public.get_user_organization(auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can create time entries for their projects" ON public.time_entries;
CREATE POLICY "Users can create time entries in their organization"
ON public.time_entries
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND is_project_member(auth.uid(), project_id)
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = time_entries.project_id
    AND p.organization_id = public.get_user_organization(auth.uid())
  )
);

-- Update trigger for new projects to include organization_id
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set organization_id from user's profile if not provided
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_user_organization(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_project_organization
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_project();