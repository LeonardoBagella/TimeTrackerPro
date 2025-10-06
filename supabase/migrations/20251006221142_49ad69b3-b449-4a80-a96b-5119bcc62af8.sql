-- Add policy to allow admins to view all time entries
CREATE POLICY "Admins can view all time entries"
ON public.time_entries
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));
