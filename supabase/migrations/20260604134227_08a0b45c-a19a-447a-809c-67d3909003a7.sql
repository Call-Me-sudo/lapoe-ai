UPDATE public.system_bot_groups AS g
SET linked_owner_id = p.id,
    updated_at = now()
FROM public.profiles AS p
WHERE g.linked_owner_id IS NULL
  AND g.added_by_tg IS NOT NULL
  AND p.telegram_user_id IS NOT NULL
  AND g.added_by_tg = p.telegram_user_id;

DROP POLICY IF EXISTS "Linked users view own system bot groups" ON public.system_bot_groups;
DROP POLICY IF EXISTS "Linked users update own system bot groups" ON public.system_bot_groups;

CREATE POLICY "Linked users view own system bot groups"
ON public.system_bot_groups
FOR SELECT
TO authenticated
USING (linked_owner_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Linked users update own system bot groups"
ON public.system_bot_groups
FOR UPDATE
TO authenticated
USING (linked_owner_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (linked_owner_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));