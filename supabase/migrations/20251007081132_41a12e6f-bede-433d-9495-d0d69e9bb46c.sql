-- Add default_task_type column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN default_task_type TEXT NOT NULL DEFAULT 'Sviluppo';