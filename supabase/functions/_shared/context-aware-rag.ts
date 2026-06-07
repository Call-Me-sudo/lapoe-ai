// Improved RAG with conversation context awareness
// Helps both system bot and user bots understand conversation topics and provide better continuity
// Prevents hallucination by grounding responses in both knowledge base AND conversation history

export type ConversationTopic = 
  | 'referral_bonus'
  | 'star_sales'
  | 'payment_status'
  | 'account_setup'
  | 'withdrawal'
  | 'general_support'
  | 'product_inquiry'
  | 'technical_issue'
  | 'other';

export interface ConversationContext {
  contextId: string;
  messageCount: number;
  contextSummary: string | null;
  userIntent: string | null;
  primaryTopic: ConversationTopic;
  isExisting: boolean;
}

export interface RAGResult {
  snippets: string;
  topic: ConversationTopic;
  contextInjection: string;
}

// Topic detection patterns for more accurate RAG retrieval
const TOPIC_PATTERNS: Record<ConversationTopic, RegExp> = {
  referral_bonus: /\b(referral|bonus|refer|commission|incentive|reward|earn.*refer)\b/i,
  star_sales: /\b(star|sell.*star|selling.*star|stars.*sale|payment.*star|star.*payment|starstore|exchange|convert)\b/i,
  payment_status: /\b(payment|when.*receive|how long|time|process|withdraw|pending|payout|receive)\b/i,
  account_setup: /\b(setup|register|sign up|create.*account|account|link|connect|verify|authenticate)\b/i,
  withdrawal: /\b(withdraw|withdrawal|cash out|cash|USDT|address|wallet|bank)\b/i,
  general_support: /\b(help|support|question|issue|problem|can you|how do i|how to)\b/i,
  product_inquiry: /\b(what is|feature|feature|service|product|how.*work|price|cost)\b/i,
  technical_issue: /\b(error|bug|not work|broken|crash|fail|issue|problem.*technical)\b/i,
  other: /^/i, // Matches everything as fallback
};

const TOPIC_ORDER: ConversationTopic[] = [
  'star_sales',      // Check star sales first - it's specific and important
  'payment_status',  // Payment info follows naturally
  'referral_bonus',  // Separate category to avoid confusion
  'withdrawal',
  'account_setup',
  'product_inquiry',
  'technical_issue',
  'general_support',
  'other',
];

/**
 * Detect primary topic from text + context
 * Uses pattern matching and previous context for accuracy
 */
export function detectPrimaryTopic(
  userText: string,
  previousTopic: ConversationTopic = 'other',
  contextSummary: string | null = null
): ConversationTopic {
  const combined = `${userText} ${contextSummary || ''}`.toLowerCase();
  
  // Check patterns in priority order
  for (const topic of TOPIC_ORDER) {
    if (TOPIC_PATTERNS[topic].test(combined)) {
      return topic;
    }
  }
  
  // If this is a follow-up and no new topic detected, assume same topic
  if (previousTopic !== 'other') {
    return previousTopic;
  }
  
  return 'other';
}

/**
 * Extract user intent from text (what the user actually wants)
 */
export function extractUserIntent(userText: string): string {
  const text = userText.trim().slice(0, 200); // First 200 chars
  
  // Remove greetings/filler
  let cleaned = text
    .replace(/^(hi|hello|hey|thanks|thank you|ok|okay|alright|sure|yeah|yes|no)\b\s*/i, '')
    .replace(/\s*(please|please.*|thanks.*|thank you.*)$/i, '')
    .trim();
  
  if (!cleaned) return userText.slice(0, 100);
  return cleaned;
}

/**
 * Build context injection string for system prompt
 * Provides grounded context from conversation thread
 */
export function buildContextInjection(
  context: ConversationContext | null,
  recentHistory: { role: string; content: string }[]
): string {
  if (!context || !context.isExisting) {
    return '';
  }
  
  let injection = '\n=== CONVERSATION CONTEXT ===\n';
  
  if (context.contextSummary) {
    injection += `User background: ${context.contextSummary}\n`;
  }
  
  if (context.userIntent) {
    injection += `Current request: ${context.userIntent}\n`;
  }
  
  injection += `Topic: ${context.primaryTopic}\n`;
  injection += `Messages in thread: ${context.messageCount}\n`;
  
  // Add last bot reply as reference if it exists
  if (recentHistory.length > 0) {
    const lastBotReply = recentHistory
      .reverse()
      .find((msg) => msg.role === 'assistant');
    
    if (lastBotReply) {
      const summary = lastBotReply.content.slice(0, 150);
      injection += `Previous answer: ${summary}${lastBotReply.content.length > 150 ? '...' : ''}\n`;
    }
  }
  
  injection += '=== END CONTEXT ===\n';
  injection += 'Use this context to provide continuity. If the user is following up, acknowledge the previous discussion.\n';
  
  return injection;
}

/**
 * Enhanced RAG snippet selection based on topic
 * Prioritizes knowledge chunks relevant to detected topic
 */
export async function enhancedRAGSnippets(
  supabase: any,
  botId: string,
  question: string,
  topic: ConversationTopic,
  k = 6
): Promise<RAGResult> {
  const q = (question || '').trim();
  if (!q) {
    return {
      snippets: '',
      topic,
      contextInjection: `[TOPIC: ${topic}]`,
    };
  }
  
  // Build topic-aware query hint
  let topicHint = '';
  if (topic === 'star_sales') {
    topicHint = ' selling stars exchange payment';
  } else if (topic === 'payment_status') {
    topicHint = ' timeline when receive processing';
  } else if (topic === 'referral_bonus') {
    topicHint = ' referral commission bonus earnings';
  } else if (topic === 'withdrawal') {
    topicHint = ' withdraw cashout USDT address wallet';
  }
  
  // Try natural query first
  let { data } = await supabase.rpc('match_knowledge_chunks_text', {
    _bot_id: botId,
    _query: q + topicHint,
    _match_count: k,
  });
  
  // If nothing matched, OR-join meaningful tokens and retry
  if (!data || data.length === 0) {
    const tokens = (q + topicHint)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 2);
    
    if (tokens.length > 0) {
      const orQuery = tokens.join(' or ');
      const r = await supabase.rpc('match_knowledge_chunks_text', {
        _bot_id: botId,
        _query: orQuery,
        _match_count: k,
      });
      data = r.data;
    }
  }
  
  // Final fallback: recent chunks
  if (!data || data.length === 0) {
    const { data: recent } = await supabase
      .from('knowledge_chunks')
      .select('content')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })
      .limit(k);
    
    if (recent && recent.length > 0) {
      const snippets = recent
        .map((r: any, i: number) => `[${i + 1}] ${r.content}`)
        .join('\n\n')
        .slice(0, 6000);
      
      return {
        snippets,
        topic,
        contextInjection: `[TOPIC: ${topic}] [FALLBACK_KNOWLEDGE]`,
      };
    }
    
    return {
      snippets: '',
      topic,
      contextInjection: `[TOPIC: ${topic}] [NO_KNOWLEDGE_AVAILABLE]`,
    };
  }
  
  const snippets = data
    .map((r: any, i: number) => `[${i + 1}] ${r.content}`)
    .join('\n\n')
    .slice(0, 6000);
  
  return {
    snippets,
    topic,
    contextInjection: `[TOPIC: ${topic}]`,
  };
}

/**
 * Get or create conversation context for a user
 */
export async function getOrCreateContext(
  supabase: any,
  botId: string,
  ownerId: string,
  groupId: string | null,
  telegramUser: string,
  currentMessageId: string | null = null
): Promise<ConversationContext> {
  const { data } = await supabase.rpc('get_or_create_conversation_context', {
    _bot_id: botId,
    _owner_id: ownerId,
    _group_id: groupId,
    _telegram_user: telegramUser,
    _current_message_id: currentMessageId,
  });
  
  return {
    contextId: data.context_id,
    messageCount: data.message_count,
    contextSummary: data.context_summary,
    userIntent: data.user_intent,
    primaryTopic: data.primary_topic as ConversationTopic,
    isExisting: data.is_existing,
  };
}

/**
 * Update conversation context after bot processes message
 */
export async function updateContext(
  supabase: any,
  contextId: string,
  updates: {
    primaryTopic?: ConversationTopic;
    contextSummary?: string;
    userIntent?: string;
    lastBotReplyId?: string;
  }
): Promise<void> {
  await supabase.rpc('update_conversation_context', {
    _context_id: contextId,
    _primary_topic: updates.primaryTopic || null,
    _context_summary: updates.contextSummary || null,
    _user_intent: updates.userIntent || null,
    _last_bot_reply_id: updates.lastBotReplyId || null,
  });
}

/**
 * Build improved system prompt that includes context injection
 */
export function buildImprovedSystemPrompt(
  baseSystemPrompt: string,
  conversationContext: ConversationContext | null,
  ragResult: RAGResult
): string {
  // Insert context injection before knowledge base section if exists
  let prompt = baseSystemPrompt;
  
  if (conversationContext?.isExisting) {
    // Build context info
    const contextInfo = buildContextInjection(conversationContext, []);
    
    // Find where to inject (before knowledge base marker if exists)
    const knowledgeMarker = '=== KNOWLEDGE BASE';
    const idx = prompt.indexOf(knowledgeMarker);
    
    if (idx > 0) {
      prompt = prompt.slice(0, idx) + contextInfo + prompt.slice(idx);
    } else {
      // No knowledge base section, append at end
      prompt += contextInfo;
    }
  }
  
  // Add anti-hallucination reminder for specific topics
  if (ragResult.topic === 'payment_status' || ragResult.topic === 'star_sales') {
    const topicReminder = `\n\nIMPORTANT: The user is asking about ${ragResult.topic.replace('_', ' ')} specifics. ONLY use information from the KNOWLEDGE BASE above. Do NOT invent timelines, process details, or payment information. If you don't know exact details, say "I don't have specific details, but based on our knowledge base..." and reference what IS documented.`;
    prompt += topicReminder;
  }
  
  return prompt;
}
