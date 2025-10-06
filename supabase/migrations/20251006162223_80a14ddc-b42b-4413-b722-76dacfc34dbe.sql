-- Allow users to join projects themselves
CREATE POLICY "Users can join projects themselves"
ON public.project_members
FOR INSERT
WITH CHECK (user_id = auth.uid());