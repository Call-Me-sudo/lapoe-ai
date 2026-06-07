# Bot Improvements: Context-Aware RAG & Conversation Memory

## Problem Statement

Two critical issues were identified with the bot responses:

### Issue 1: Incorrect Information (Referral Bonus vs Star Sales)
**Scenario**: User asked about when they would receive payment for selling stars.
```
User: "I have 11,325 stars. I decided to give a try first when I receive my payment on June 23 then I will sell the remaining 10k stars"
Bot (Wrong): "For referral bonuses, withdrawals are processed instantly..."
Expected: Information specifically about star sales payments, not referral bonuses
```

**Root Cause**: The RAG (Retrieval-Augmented Generation) system wasn't context-aware. It couldn't distinguish between different topics (star sales vs referral bonuses) and returned wrong knowledge chunks.

### Issue 2: No Conversation Memory (Broken Follow-ups)
**Scenario**: User asks a follow-up question in the same conversation.
```
User: "That means you basically don't have memory of the past conversation..."
Bot (Wrong): "Yeah, that's right. I don't have memory..."
Expected: Acknowledgment of previous discussion with context
```

**Root Cause**: The bot only kept the last 10 messages in `bot_messages` table and passed only the last 8 to the AI. Without conversation threading or context tracking, follow-ups had no reference to the original topic.

---

## Solution Overview

### 3-Layer Enhancement Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Conversation Context Tracking (NEW)             │
│ - Detects conversation topic/theme                       │
│ - Tracks user intent across messages                     │
│ - Maintains 24-hour conversation thread                  │
│ - Links follow-ups to original discussion               │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Layer 2: Topic-Aware RAG (ENHANCED)                     │
│ - Detects primary topic (star_sales, payment_status, etc) │
│ - Prioritizes knowledge chunks by topic                 │
│ - Adds topic hints to search queries                    │
│ - Prevents cross-topic confusion                        │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Layer 3: System Prompt Enrichment (ENHANCED)            │
│ - Injects conversation context into system prompt       │
│ - Adds topic-specific anti-hallucination rules          │
│ - Provides previous bot response as reference           │
│ - Maintains conversation continuity                     │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Database Schema: `conversation_contexts` Table

**Purpose**: Stores conversation thread metadata for each user per bot.

```sql
CREATE TABLE conversation_contexts (
  id UUID PRIMARY KEY,
  bot_id UUID,                          -- Which bot (or 'system-bot')
  telegram_user TEXT,                   -- User's Telegram ID/username
  
  -- Topic tracking
  primary_topic conversation_topic,     -- ENUM: star_sales, payment_status, etc.
  secondary_topics conversation_topic[],
  
  -- Thread linking
  first_message_id UUID,                -- First message in this thread
  last_message_id UUID,                 -- Most recent message
  last_bot_reply_id UUID,               -- Bot's last reply in thread
  
  -- Context for RAG injection
  context_summary TEXT,                 -- e.g., "User has 11,325 stars..."
  user_intent TEXT,                     -- e.g., "Asking about payment timeline"
  
  message_count INT,                    -- How many messages in this thread
  is_active BOOLEAN,                    -- Auto-deactivates after 2 hours
  
  last_activity_at TIMESTAMPTZ          -- For conversation continuity detection
);
```

**Lifecycle**:
1. When message arrives → `get_or_create_conversation_context()` checks for active thread (last 24h)
2. If found and recent (< 2h) → extend existing context
3. If old (> 2h) → mark inactive and create new context (new conversation)
4. After bot responds → `update_conversation_context()` records detected topic and intent

### 2. Topic Detection System

**File**: `supabase/functions/_shared/context-aware-rag.ts`

Topics are detected using regex patterns with **priority order**:

```typescript
const TOPIC_ORDER = [
  'star_sales',        // ⭐ Checked first - most specific
  'payment_status',    // Payment/timeline questions
  'referral_bonus',    // Different category to avoid confusion!
  'withdrawal',
  'account_setup',
  'product_inquiry',
  'technical_issue',
  'general_support',
  'other'
];
```

**Why This Fixes Issue #1**: 
- User says "11,325 stars" + "June 23" + "sell" → matches `star_sales` pattern
- Bot retrieves knowledge chunks tagged for star sales, NOT referral bonuses
- Even if referral info exists in KB, it won't match the star_sales query

### 3. Enhanced RAG Retrieval

**Old Process**:
```
Query → Vector search → Return top-6 chunks
Problem: No topic context, returns whatever matches best
```

**New Process**:
```
Query → Detect topic → Add topic hints to query → Vector search → Return top-6 chunks
Example:
  Original query: "when will I get my payment"
  Detected topic: payment_status
  Enhanced query: "when will I get my payment timeline when receive processing"
Result: Retrieves payment-specific chunks, not general support info
```

**File**: `supabase/functions/_shared/context-aware-rag.ts:enhancedRAGSnippets()`

```typescript
// Topic-aware query hints
if (topic === 'star_sales') {
  topicHint = ' selling stars exchange payment';
} else if (topic === 'payment_status') {
  topicHint = ' timeline when receive processing';
}

// Query with hints
const enhancedQuery = q + topicHint;
// e.g., "when will I get my payment timeline when receive processing"
```

### 4. Conversation Context Injection

**Old System Prompt**:
```
You are [bot_name]. Tone: [tone]. House rules: [rules]

=== KNOWLEDGE BASE ===
[knowledge chunks]
=== END ===

Reply rules: ...
```

**New System Prompt** (same base + context layer):
```
You are [bot_name]. Tone: [tone]. House rules: [rules]

=== CONVERSATION CONTEXT ===
User background: User has 11,325 stars, wants to sell 10k on June 23
Current request: Asking about payment timeline for star sales
Topic: star_sales
Messages in thread: 2
Previous answer: [bot's last response]
=== END CONTEXT ===

Use this context to provide continuity. If the user is following up, acknowledge the previous discussion.

=== KNOWLEDGE BASE ===
[topic-specific knowledge chunks]
=== END ===

IMPORTANT: The user is asking about star_sales specifics. ONLY use information from the KNOWLEDGE BASE above. Do NOT invent timelines, process details, or payment information.
```

**Why This Fixes Issue #2**:
- Previous conversation summary is now in the system prompt
- AI understands it's a follow-up, not a new isolated question
- Bot can reference "we already discussed" rather than saying "I don't have memory"

### 5. Anti-Hallucination Guardrails for Sensitive Topics

For topics like `payment_status` and `star_sales`, the system prompt gets a specific reminder:

```typescript
// In buildImprovedSystemPrompt()
if (ragResult.topic === 'payment_status' || ragResult.topic === 'star_sales') {
  const topicReminder = `
    IMPORTANT: User asking about ${topic} specifics. 
    ONLY use info from KNOWLEDGE BASE. 
    Do NOT invent timelines, process details, or payment info.
    If uncertain, say "Based on our knowledge base..."
  `;
  prompt += topicReminder;
}
```

---

## Integration Points

### telegram-poll (User Bots)

**File**: `supabase/functions/telegram-poll/index.ts`

Changes in `handleSingleUpdate()` function:

```typescript
// 1. Get or create conversation context
conversationContext = await getOrCreateContext(
  supabase, bot.id, bot.owner_id, group?.id, 
  telegramUser, inboundLog?.id
);

// 2. Detect topic from this message
const detectedTopic = detectPrimaryTopic(
  cleanText,
  conversationContext.primaryTopic,  // Previous topic
  conversationContext.contextSummary
);

// 3. Use enhanced RAG (topic-aware)
ragResult = await enhancedRAGSnippets(
  supabase, bot.id, retrievalText, detectedTopic, 6
);

// 4. Inject context into system prompt
const system = buildImprovedSystemPrompt(
  baseSystem, conversationContext, ragResult
);

// 5. Get bot response
const reply = await askAI(system, cleanText, history);

// 6. Update context with this interaction
await updateContext(supabase, contextId, {
  primaryTopic: detectedTopic,
  contextSummary: extractedUserIntent,
  lastBotReplyId: outboundLog.id
});
```

### lapoe-system-bot (System Bot @LaPoe_bot)

**File**: `supabase/functions/lapoe-system-bot/index.ts`

Changes in `handleGroupAi()` function:

- Same 6-step flow as telegram-poll
- Uses `"system-bot"` as special bot_id for context tracking
- Topic detection helps system bot prioritize knowledge correctly

---

## How This Solves the Original Issues

### Issue #1: Wrong Information (Referral Bonus vs Star Sales)

**Before**:
```
User query: "when will I get my payment"
RAG: Searches knowledge base generically
Result: Returns referral bonus info (happens to match best)
```

**After**:
```
User context: mentions "11,325 stars", "sell", "June 23"
Detected topic: star_sales ✓
RAG: Searches for "payment timeline when receive processing" + topic hint
Result: Returns star sales payment info (specific to user's question)
```

### Issue #2: No Follow-up Memory (No Conversation Continuity)

**Before**:
```
User Q1: "when will I receive my payment for 11,325 stars?"
Bot A1: "Your stars sale processing takes 2-3 business days..."

User Q2: "That means you don't have memory of past convos?"
Bot A2: "Yeah, I don't have memory of past conversations" ❌
```

**After**:
```
User Q1: "when will I receive my payment for 11,325 stars?"
Bot A1: "Your stars sale processing takes 2-3 business days..."
[Context stored: topic=star_sales, intent="asking about payment timeline"]

User Q2: "That means you don't have memory of past convos?"
Bot A2: "Actually, I do remember! We were just discussing your 11,325 stars and the payment timeline. What else would you like to know?" ✓
```

---

## Deployment Steps

### 1. Apply Database Migration

```bash
# This creates the conversation_contexts table and helper functions
supabase migration up
```

### 2. Deploy Functions (Auto via Supabase)

The following functions automatically include the new imports:
- `supabase/functions/telegram-poll/index.ts`
- `supabase/functions/lapoe-system-bot/index.ts`
- Both import `context-aware-rag.ts` (new shared utility)

### 3. Rollback Plan (if needed)

The changes are **non-breaking**:
- New table (`conversation_contexts`) is optional
- Old RAG still works as fallback if context enhancement fails
- Try-catch blocks ensure graceful degradation
- Functions will work even if migration isn't applied yet

```typescript
try {
  // New context-aware flow
  conversationContext = await getOrCreateContext(...);
  ragResult = await enhancedRAGSnippets(...);
  system = buildImprovedSystemPrompt(...);
} catch (e) {
  // Fallback to old flow
  const [knowledgeResult] = await ragSnippets(...);
  system = buildSystemPrompt(...);
}
```

---

## Testing Scenarios

### Test Case 1: Star Sales Question (Issue #1 Fix)

```
Group: StarStore Community
User: "I have 11,325 stars and want to sell 10k on June 23. When do I get paid?"

Expected:
- Bot detects topic: star_sales ✓
- RAG retrieves star sales knowledge ✓
- Response: "Star sales typically process within 2-3 business days..."
- NOT: "Referral bonuses process instantly..."
```

### Test Case 2: Follow-up Conversation (Issue #2 Fix)

```
Message 1:
User: "How long does star selling take?"
Bot: "Usually 2-3 business days."
[Context: topic=star_sales, intent=asking_about_timeline]

Message 2 (5 minutes later):
User: "Do you remember this conversation?"
Bot: "Yes! We were just discussing your star sales timeline. 
      It typically takes 2-3 business days. Do you have other questions?"
```

### Test Case 3: Topic Switching

```
Message 1: "Do you give referral bonuses?" 
[Context: topic=referral_bonus]

Message 2: "Can I sell my stars?"
[Context: topic=star_sales] (switches topics appropriately)
```

---

## Future Improvements

1. **Semantic Clustering**: Group similar questions within a conversation
2. **User Profiles**: Build user-specific context over weeks/months
3. **Feedback Loop**: Use unanswered questions to improve RAG
4. **Topic Confidence Scoring**: Tag responses with confidence levels
5. **Cross-Bot Knowledge Sharing**: Share context between user bots
6. **Analytics**: Track which topics need better knowledge base coverage

---

## Key Benefits

✅ **Fixed Incorrect Answers**: Topic-aware RAG prevents cross-topic confusion  
✅ **Added Conversation Memory**: 24-hour conversation threads with context injection  
✅ **Improved Follow-ups**: Bot acknowledges previous discussions  
✅ **Anti-Hallucination**: Extra guardrails for sensitive topics (payments, sales)  
✅ **Non-Breaking**: Gracefully falls back if enhancements fail  
✅ **Same Foundation**: All original bot logic intact, only enhanced  
✅ **Applies to Both Bots**: User bots AND system bot @LaPoe_bot benefit  

---

## Files Modified

1. **New Migration**: `supabase/migrations/20260607000001_add_conversation_context.sql`
   - Creates `conversation_contexts` table
   - Adds `get_or_create_conversation_context()` RPC
   - Adds `update_conversation_context()` RPC

2. **New Utility**: `supabase/functions/_shared/context-aware-rag.ts`
   - `detectPrimaryTopic()` - Topic detection
   - `enhancedRAGSnippets()` - Topic-aware retrieval
   - `getOrCreateContext()` - Context management
   - `updateContext()` - Context updates
   - `buildImprovedSystemPrompt()` - System prompt enrichment

3. **Updated**: `supabase/functions/telegram-poll/index.ts`
   - Import context utilities
   - Integrate context tracking in `handleSingleUpdate()`

4. **Updated**: `supabase/functions/lapoe-system-bot/index.ts`
   - Import context utilities
   - Integrate context tracking in `handleGroupAi()`

---

## Maintenance Notes

- **Context Cleanup**: Inactive contexts (>24h) are automatically marked inactive
- **Performance**: Context lookups use indexed queries (bot_id, telegram_user, is_active)
- **Storage**: Minimal overhead (~200 bytes per conversation thread)
- **Observability**: All context operations logged via console.warn/error

---
