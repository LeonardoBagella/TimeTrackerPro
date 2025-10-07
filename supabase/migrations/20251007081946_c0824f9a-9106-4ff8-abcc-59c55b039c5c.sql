-- Update existing profiles to use English values for consistency
UPDATE public.profiles 
SET default_task_type = CASE 
  WHEN default_task_type IN ('Sviluppo', 'Development') THEN 'development'
  WHEN default_task_type IN ('Analisi', 'Analysis') THEN 'analysis'
  WHEN default_task_type IN ('Riunione', 'Meeting') THEN 'meeting'
  ELSE 'development'
END
WHERE default_task_type IS NOT NULL;

-- Update the default value to use English
ALTER TABLE public.profiles 
ALTER COLUMN default_task_type SET DEFAULT 'development';