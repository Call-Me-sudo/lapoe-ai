
DO $$
DECLARE
  v_source_id uuid := '242be188-441b-434e-905c-bb9904b9ae17';
  v_bot_id    uuid;
  v_owner_id  uuid;
  v_content   text := $C$StarStore Ambassador Program

What it is:
The StarStore Ambassador Program lets members earn monthly commissions by promoting Telegram Stars and Telegram Premium subscriptions sold through StarStore. It is run by StarStore (https://starstore.app) and the dedicated site is https://amb.starstore.app.

How to apply / join:
Applications are handled inside the StarStore Telegram Mini App. To apply, open the StarStore bot on Telegram (@TgStarStore_bot) or the StarStore channel (@StarStore_app), launch the Mini App, and follow the Ambassador application flow there. Applications are not accepted by DM to this bot or by email — they must go through the Mini App.

Tiers & commissions:
The program has three ambassador tiers, with commissions of up to 20% on qualifying sales of Telegram Stars and Telegram Premium. Higher tiers unlock higher commission rates and additional perks.

Payouts:
Commissions are paid monthly, in USDT.

Support / contact:
For questions about the Ambassador Program, contact support@starstore.app or visit https://amb.starstore.app/contact.

Related links:
- Ambassador site: https://amb.starstore.app
- Main store: https://starstore.app
- Blog: https://starstore.app/blog
- Telegram channel: https://t.me/StarStore_app
- StarStore bot: https://t.me/TgStarStore_bot

Note: This bot cannot approve, reject, or check the status of ambassador applications. Always apply and check status inside the StarStore Mini App.$C$;
BEGIN
  SELECT bot_id, owner_id INTO v_bot_id, v_owner_id
  FROM public.knowledge_sources WHERE id = v_source_id;

  UPDATE public.knowledge_sources
  SET kind = 'text',
      content = v_content,
      source_url = NULL,
      chunk_count = 1,
      indexed_at = now(),
      indexing_error = NULL
  WHERE id = v_source_id;

  DELETE FROM public.knowledge_chunks WHERE source_id = v_source_id;

  INSERT INTO public.knowledge_chunks (source_id, bot_id, owner_id, chunk_index, content)
  VALUES (v_source_id, v_bot_id, v_owner_id, 0, v_content);
END $$;
