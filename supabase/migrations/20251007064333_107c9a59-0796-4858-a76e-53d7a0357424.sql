-- Add daily_cost field to profiles table
ALTER TABLE public.profiles
ADD COLUMN daily_cost integer;

COMMENT ON COLUMN public.profiles.daily_cost IS 'Daily cost of the user in euros';

-- Add budget field to projects table
ALTER TABLE public.projects
ADD COLUMN budget integer;

COMMENT ON COLUMN public.projects.budget IS 'Project budget in euros';