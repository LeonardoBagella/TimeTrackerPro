
-- Delete all time entries for organization Soluxioni
DELETE FROM public.time_entries 
WHERE project_id IN (
  SELECT id FROM public.projects 
  WHERE organization_id = '3f10d259-90de-411a-8276-71db4ef4fa90'
);
