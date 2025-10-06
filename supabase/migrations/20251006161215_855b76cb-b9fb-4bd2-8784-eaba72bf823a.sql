-- Create project_members table for many-to-many relationship
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Populate with existing projects (creators are automatically members)
INSERT INTO public.project_members (project_id, user_id)
SELECT id, user_id FROM public.projects;

-- RLS policies for project_members
CREATE POLICY "Users can view project members of their projects"
ON public.project_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = project_members.project_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Project creators can add members"
ON public.project_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_members.project_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Project creators can remove members"
ON public.project_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_members.project_id
    AND p.user_id = auth.uid()
  )
);

-- Update projects RLS policies to allow members to view
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view projects they are members of"
ON public.projects
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = projects.id
    AND pm.user_id = auth.uid()
  )
);

-- Update time_entries RLS policies to allow members to log time
DROP POLICY IF EXISTS "Users can view their own time entries" ON public.time_entries;
CREATE POLICY "Users can view time entries for their projects"
ON public.time_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = time_entries.project_id
    AND pm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create their own time entries" ON public.time_entries;
CREATE POLICY "Users can create time entries for their projects"
ON public.time_entries
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = time_entries.project_id
    AND pm.user_id = auth.uid()
  )
);

-- Create trigger to automatically add creator as member
CREATE OR REPLACE FUNCTION public.add_creator_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id)
  VALUES (NEW.id, NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.add_creator_as_member();