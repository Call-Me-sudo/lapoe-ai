ALTER PUBLICATION supabase_realtime SET TABLE
  public.profiles,
  public.bots (id, owner_id, name, description, default_instructions, status, created_at, updated_at, tone, personality, house_rules, welcome_message, banned_words, moderation_enabled, bot_username, bot_telegram_id, anti_flood_enabled, anti_spam_enabled, flood_sensitivity),
  public.knowledge_sources,
  public.bot_messages,
  public.moderation_actions,
  public.notifications;