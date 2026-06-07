-- ============ CONVERSATION CONTEXT (Memory & Topic Tracking) ============
-- Tracks conversation themes, topics, and context to improve follow-ups and context awareness
-- Enables bots to understand they're part of a continuous dialogue, not isolated queries

create type public.conversation_topic as enum (
  'referral_bonus',
  'star_sales',
  'payment_status',
  'account_setup',
  'withdrawal',
  'general_support',
  'product_inquiry',
  'technical_issue',
  'other'
);

create table public.conversation_contexts (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.telegram_groups(id) on delete set null,
  telegram_user text not null,
  
  -- Primary topic of this conversation thread
  primary_topic public.conversation_topic not null default 'other',
  secondary_topics public.conversation_topic[] default '{}',
  
  -- Thread tracking
  first_message_id uuid references public.bot_messages(id) on delete set null,
  last_message_id uuid references public.bot_messages(id) on delete set null,
  last_bot_reply_id uuid references public.bot_messages(id) on delete set null,
  
  -- Context summary for RAG injection
  context_summary text, -- e.g., "User has 11,325 stars, wants to sell 10k on June 23"
  user_intent text,     -- e.g., "Asking about payment timeline for star sales"
  
  -- Metadata
  message_count int not null default 1,
  is_active boolean not null default true,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

alter table public.conversation_contexts enable row level security;

create policy "Owners view own contexts" on public.conversation_contexts
  for select to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

create policy "Owners insert own contexts" on public.conversation_contexts
  for insert to authenticated
  with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

create policy "Owners update own contexts" on public.conversation_contexts
  for update to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'))
  with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

-- Index for fast context lookups
create index idx_conversation_contexts_bot_user on public.conversation_contexts(bot_id, telegram_user, is_active);
create index idx_conversation_contexts_group_user on public.conversation_contexts(group_id, telegram_user, is_active);
create index idx_conversation_contexts_last_activity on public.conversation_contexts(last_activity_at);

-- ============ RPC: Get Active Conversation Context ============
-- Retrieves active context for a user in a bot/group, or creates new one if none exists
create or replace function public.get_or_create_conversation_context(
  _bot_id uuid,
  _owner_id uuid,
  _group_id uuid,
  _telegram_user text,
  _current_message_id uuid default null
)
returns json
language plpgsql
as $$
declare
  _context_id uuid;
  _context record;
  _context_age_minutes int;
begin
  -- Look for active context from last 24 hours
  select id, message_count, context_summary, user_intent, primary_topic
  into _context
  from public.conversation_contexts
  where bot_id = _bot_id
    and telegram_user = _telegram_user
    and is_active = true
    and (_group_id is null or group_id = _group_id)
    and now() - last_activity_at < interval '24 hours'
  order by last_activity_at desc
  limit 1;
  
  if found then
    -- Update existing context
    _context_age_minutes := extract(epoch from (now() - _context.last_activity_at)) / 60;
    
    -- Mark as inactive if no activity for 2 hours (new conversation)
    if _context_age_minutes > 120 then
      update public.conversation_contexts
      set is_active = false
      where id = _context.id;
    else
      -- Extend the active context
      update public.conversation_contexts
      set 
        message_count = message_count + 1,
        last_message_id = _current_message_id,
        last_activity_at = now()
      where id = _context.id;
      
      return json_build_object(
        'context_id', _context.id,
        'message_count', _context.message_count + 1,
        'context_summary', _context.context_summary,
        'user_intent', _context.user_intent,
        'primary_topic', _context.primary_topic,
        'is_existing', true
      );
    end if;
  end if;
  
  -- Create new context
  insert into public.conversation_contexts(
    bot_id, owner_id, group_id, telegram_user,
    first_message_id, last_message_id, message_count
  ) values (
    _bot_id, _owner_id, _group_id, _telegram_user,
    _current_message_id, _current_message_id, 1
  )
  returning id
  into _context_id;
  
  return json_build_object(
    'context_id', _context_id,
    'message_count', 1,
    'context_summary', null,
    'user_intent', null,
    'primary_topic', 'other'::text,
    'is_existing', false
  );
end;
$$;

-- ============ RPC: Update Conversation Context ============
-- Updates context metadata after bot processes a message
create or replace function public.update_conversation_context(
  _context_id uuid,
  _primary_topic public.conversation_topic default null,
  _context_summary text default null,
  _user_intent text default null,
  _last_bot_reply_id uuid default null
)
returns void
language plpgsql
as $$
begin
  update public.conversation_contexts
  set
    primary_topic = coalesce(_primary_topic, primary_topic),
    context_summary = coalesce(_context_summary, context_summary),
    user_intent = coalesce(_user_intent, user_intent),
    last_bot_reply_id = coalesce(_last_bot_reply_id, last_bot_reply_id),
    updated_at = now()
  where id = _context_id;
end;
$$;

-- ============ Function: Set Updated At ============
create trigger cc_set_updated_at before update on public.conversation_contexts
  for each row execute function public.set_updated_at();
