# Instruction System Analysis

**Date:** 2026-06-07  
**Status:** Investigation Complete

---

## Executive Summary

The instruction system for bots has **three defined instruction fields** but only **two are actively used**. The `bot_rules` table (with trigger-based instructions) exists but is **completely unused** in the codebase. There are **no truncation or length limits** on instructions currently enforced.

---

## 1. Current Instruction Fields in Database

### For User-Created Bots (`public.bots` table)
- **`default_instructions`** (text) — Owner's custom instructions for bot behavior
- **`house_rules`** (text) — Group rules the bot should enforce
- **`personality`** (text) — Character/personality descriptor

**Migration:** Added in [20260501051546](supabase/migrations/20260501051546_f0778910-08ba-41d0-89f6-6011d0578495.sql)

### For System Bot (`public.system_bot_personas` table)
- **`house_rules`** (text) — Rules specific to the linked owner's usage
- **`personality`** (text) — Character descriptor
- **`display_name`** (text) — Name the bot presents as
- **`welcome_message`** (text) — Welcome message when linked
- **`tone`** (text) — Tone setting (friendly, professional, witty, strict, hype)

**Migration:** Created in [20260604130023](supabase/migrations/20260604130023_971eb6d8-5698-4e64-b578-7cb2d9c6eaf8.sql)

### Unused: Trigger-Based Rules (`public.bot_rules` table)
- **`trigger_keyword`** (text) — Keyword to match
- **`instruction`** (text) — Instruction to inject when triggered
- **`is_active`** (boolean)
- **Scope:** Global, per-group, or per-bot

**Migration:** Created in [20260429052457](supabase/migrations/20260429052457_913ce1a9-192e-452e-8127-6b06629f950d.sql)

**Status:** ❌ **NOT USED ANYWHERE** — defined but never fetched or injected into prompts

---

## 2. How Instructions Are Currently Used

### In `telegram-poll/index.ts` (User Bots)

**System Prompt Building** ([line 365-430](supabase/functions/telegram-poll/index.ts#L365-L430)):

```typescript
function buildSystemPrompt(bot: any, group: any | null, knowledge: string, knowledgeExists: boolean): string {
  const tone = TONES[bot.tone] || TONES.friendly;
  const persona = bot.personality || "";
  const groupCtx = group
    ? `You are currently in the Telegram group "${group.name}"...`
    : "You are in a private chat.";
  
  // ⚠️ Instructions are injected here:
  const houseRules = bot.house_rules ? `\nHouse rules to follow:\n${bot.house_rules}` : "";
  const customInstr = bot.default_instructions ? `\n\nOwner instructions:\n${bot.default_instructions}` : "";

  // Built into prompt:
  return `You are *${bot.name}*, a Telegram community bot.
Tone: ${tone}
${persona ? `Character: ${persona}\n` : ""}${groupCtx}${houseRules}${customInstr}${knowledgeBlock}
...`
}
```

**Injection Point in System Prompt:**
- House rules: Labeled section after group context
- Default instructions: Labeled section after house rules, before knowledge block

**Related Usage:**
- [Line 195](supabase/functions/telegram-poll/index.ts#L195): Used for keyword extraction in `isGroupRelated()`
- [Line 1189](supabase/functions/telegram-poll/index.ts#L1189): Included in `allowedCtx` for URL sanitization
- [Line 1189](supabase/functions/telegram-poll/index.ts#L1189): Referenced in prompt instructions about grounding

### In `lapoe-system-bot/index.ts` (System Bot)

**System Prompt Building** ([line 58-100](supabase/functions/lapoe-system-bot/index.ts#L58-L100)):

```typescript
function buildSystemBotPrompt(persona: any, knowledge: string, knowledgeExists: boolean, ownerName: string): string {
  const tone = TONES[persona?.tone] || TONES.friendly;
  const name = persona?.display_name || ownerName || "LaPoe";
  const character = persona?.personality ? `Character: ${persona.personality}\n` : "";
  
  // ⚠️ Only house_rules are injected:
  const house = persona?.house_rules ? `\nHouse rules:\n${persona.house_rules}` : "";
  
  return `You are *${name}*, a personal assistant powered by LaPoe.
Tone: ${tone}
${character}${house}${kb}
...`
}
```

**Injection Point:**
- House rules only (no default_instructions equivalent for system bot)
- Labeled section after character, before knowledge block

---

## 3. Instruction Injection Points

### For User Bots (telegram-poll):

**Complete Flow:**

| Step | Component | Code | Notes |
|------|-----------|------|-------|
| 1 | Fetch bot | Line 1050 | Loads `house_rules`, `default_instructions`, `personality` |
| 2 | Build base system prompt | Line 1180 | Concatenates all instruction fields into prompt |
| 3 | Enhance with context | Line 1183 | `buildImprovedSystemPrompt()` adds conversation context |
| 4 | Send to AI | Line 1190 | System prompt passed to LLM with history |
| 5 | Sanitize response | Line 1189 | `allowedCtx` includes instructions for URL validation |

**Concatenation Order:**
```
You are [bot.name]...
Tone: [tone]
Character: [personality]
Group context: [group.name, welcome_message, rules]
House rules: [house_rules]
Owner instructions: [default_instructions]
Knowledge base: [ragResult.snippets]
Platform info: [LAPOE_SELF_KB]
```

### For System Bot (lapoe-system-bot):

**Complete Flow:**

| Step | Component | Code | Notes |
|------|-----------|------|-------|
| 1 | Fetch persona | Line 1014 | Loads `house_rules`, `personality`, `display_name`, `tone` |
| 2 | Build system prompt | Line 1073 | Concatenates persona fields |
| 3 | Enhance with context | Line 1073-1078 | Builds improved prompt with RAG |
| 4 | Send to AI | - | System prompt passed to LLM |

**Concatenation Order:**
```
You are [persona.display_name]...
Tone: [tone]
Character: [personality]
House rules: [house_rules]
Knowledge base: [rag.text]
Platform info: [LAPOE_SELF_KB]
```

---

## 4. Instruction Field Characteristics

### `default_instructions` (User Bots Only)
- **Scope:** Bot-wide
- **Label in prompt:** "Owner instructions:"
- **Position:** After house rules, before knowledge base
- **Frequency of use:** On every message
- **Truncation:** None
- **Field type:** `text` (no length limit enforced in schema)

### `house_rules` (Both Bots & System Bot)
- **Scope:** Bot-wide or persona-wide
- **Label in prompt:** "House rules:" (user bots) or "House rules:" (system bot)
- **Position:** After group context / character, before knowledge base
- **Frequency of use:** On every message
- **Truncation:** None
- **Field type:** `text` (no length limit enforced in schema)

### `personality` (Both Bots & System Bot)
- **Scope:** Bot-wide or persona-wide
- **Label in prompt:** "Character:"
- **Position:** After tone, before group context (user bots) or after tone (system bot)
- **Frequency of use:** On every message
- **Truncation:** None
- **Field type:** `text` (no length limit enforced in schema)

### `tone` (Both Bots & System Bot)
- **Type:** Enum-like (`friendly`, `professional`, `witty`, `strict`, `hype`)
- **Lookup:** Maps to predefined tone descriptions
- **Field type:** `text` (stored as string, mapped to description)

### `welcome_message` (Group-level)
- **Scope:** Group-specific
- **Position:** In group context section
- **Frequency of use:** Only in groups with defined welcome_message
- **Field type:** `text`

---

## 5. Critical Gaps & Issues

### ❌ **Gap 1: bot_rules Table Completely Unused**
- **Table exists:** `public.bot_rules` with `trigger_keyword` and `instruction`
- **Status:** Zero references in any TypeScript function
- **Impact:** Trigger-based dynamic instructions feature is not implemented
- **What's needed:** Code to fetch bot_rules, match keywords, and inject matched instructions

### ❌ **Gap 2: No reply_instructions Field**
- **Issue:** Request mentions "reply_instructions" but this field doesn't exist
- **Current alternative:** `default_instructions` serves as general-purpose instructions
- **Question:** Should `reply_instructions` be a separate field distinct from `default_instructions`?
- **Missing:** Migration to add this field if needed

### ⚠️ **Gap 3: No Instruction Truncation**
- **Issue:** No maximum length enforcement
- **Risk:** Long instruction strings could:
  - Exceed token limits for LLM
  - Overwhelm the prompt structure
  - Crowd out knowledge base or user context
- **Current mitigation:** None (rely on UI to enforce limits)
- **Recommendation:** Add length checks or truncation in system prompt builders

### ⚠️ **Gap 4: System Bot Has No default_instructions**
- **Issue:** System bot only uses `house_rules` from persona
- **Inconsistency:** User bots have both `house_rules` AND `default_instructions`
- **Question:** Should system bot personas support custom instructions beyond rules?

### ⚠️ **Gap 5: bot_rules Not Fetched or Matched**
- **Missing code:** No query to fetch `bot_rules` for a given bot
- **Missing code:** No keyword matching logic
- **Missing code:** No prompt injection for matched rules
- **Impact:** Trigger-based instructions are dead feature

---

## 6. URL Sanitization & Grounding

### How Instructions Are Grounded

In [sanitizeReply()](supabase/functions/telegram-poll/index.ts#L1186), instructions are included in the `allowedCtx` validation:

```typescript
const allowedCtx = [
  ragResult?.snippets,     // Knowledge base
  LAPOE_SELF_KB,           // Platform info
  bot.house_rules,         // ⚠️ Instructions validated here
  bot.default_instructions,// ⚠️ Instructions validated here
  bot.personality          // Character/personality
].filter(Boolean).join("\n");

// Only URLs that appear verbatim in allowedCtx are kept
const reply = sanitizeReply(stripped, allowedCtx);
```

**Impact:** Any URL the bot mentions must appear verbatim in instructions, knowledge base, or platform info. Good for preventing hallucination.

---

## 7. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Message                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Load Bot & Group Data       │
        │ - bot.default_instructions   │
        │ - bot.house_rules            │
        │ - bot.personality            │
        │ - group.rules                │
        │ - group.welcome_message      │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │  Retrieve RAG Snippets       │
        │  (Knowledge Base)            │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────────────────────┐
        │  Build System Prompt                         │
        │ ┌─────────────────────────────────────────┐  │
        │ │ You are [name]                          │  │
        │ │ Tone: [tone description]                │  │
        │ │ Character: [personality]                │  │
        │ │ [Group Context + welcome_message]       │  │
        │ │ House rules to follow:                  │  │
        │ │ [house_rules] ◄── INSTRUCTION INJECTED  │  │
        │ │ Owner instructions:                     │  │
        │ │ [default_instructions] ◄── INJECTED     │  │
        │ │ === KNOWLEDGE BASE ===                  │  │
        │ │ [ragResult.snippets]                    │  │
        │ │ === PLATFORM INFO ===                   │  │
        │ │ [LAPOE_SELF_KB]                         │  │
        │ │ [Rule enforcement prompts...]           │  │
        │ └─────────────────────────────────────────┘  │
        └──────────────┬───────────────────────────────┘
                       │
        ┌──────────────▼───────────────┐
        │  Send to LLM                 │
        │  [System Prompt + User Msg]  │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │  Receive Reply               │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────────────────────┐
        │  Sanitize Reply                              │
        │  - Remove URLs not in allowedCtx             │
        │   (which includes instructions)              │
        │  - Remove orphan reference lines             │
        └──────────────┬───────────────────────────────┘
                       │
        ┌──────────────▼───────────────┐
        │  Send to Telegram            │
        └──────────────────────────────┘
```

---

## 8. Instruction Length & Token Impact

### Current Situation
- **No maximum length** in database schema
- **No truncation** in code
- **Instructions go directly into system prompt** with no filtering

### Potential Issues
```
System Prompt Structure:
- Base instructions (tone, character rules, etc.): ~500 tokens
- Group context (name, rules): ~50-200 tokens
- User instructions (house_rules + default_instructions): ??? (could be 1000+ tokens)
- Knowledge base (6 snippets × ~200 tokens): ~1200 tokens
- Platform info (LAPOE_SELF_KB): ~150 tokens
- User message history (up to 8 messages): ~500 tokens
- Current user message: varies
────────────────────────────────────────────
Total: Could easily exceed optimal token budget
```

### Recommendation
- Add `max_instructions_tokens` config
- Truncate instructions if they exceed this limit
- Prioritize `default_instructions` over `house_rules` if truncation needed

---

## 9. Gap Summary Table

| Gap | Type | Severity | Impact | Status |
|-----|------|----------|--------|--------|
| `bot_rules` unused | Feature incomplete | ⚠️ Medium | Trigger-based instructions not available | 🔴 Not implemented |
| No `reply_instructions` field | Schema missing | ⚠️ Medium | Cannot distinguish different instruction types | 🟡 Design unclear |
| No instruction truncation | Safety issue | ⚠️ Medium | Could exceed token limits silently | 🟡 Not addressed |
| System bot lacks instructions | Inconsistency | 🟢 Low | Feature parity issue | 🟡 By design? |
| No validation in UI | Process gap | 🟢 Low | Users could paste extremely long instructions | 🟡 Needs review |

---

## 10. Recommendations

### 1. **Implement bot_rules** (High Priority)
- Add function to fetch active `bot_rules` for a bot
- Implement keyword matching in user messages
- Inject matched instructions into system prompt with label
- Example: `Bot-specific rule (matching "payment"): [instruction text]`

### 2. **Clarify reply_instructions** (High Priority)
- Decide: Is this a new field or should it replace/supplement `default_instructions`?
- Add migration if new field needed
- Document distinction in codebase

### 3. **Add Instruction Length Limits** (Medium Priority)
- Database: Add `CHECK` constraints on instruction fields
- Code: Implement truncation in `buildSystemPrompt()` with logging
- Dashboard: Add UI validation with character counters

### 4. **Create `reply_instructions` Field** (Medium Priority - depends on clarification)
- Proposed: `bots.reply_instructions` (text, separate from `default_instructions`)
- Use case: Special instructions for how the bot should reply (tone modifiers, length preferences, etc.)
- Injection: After `default_instructions` in system prompt

### 5. **Add System Bot Instructions** (Medium Priority)
- Add `system_bot_personas.default_instructions` field
- Inject similar to user bots
- Maintain consistency

### 6. **Improve Instruction Documentation** (Low Priority)
- Document in DEVELOPERS.md what each instruction field does
- Provide examples of good instructions
- Explain token impact and best practices

---

## 11. File References

### Schema Files
- [20260501051546_add_bot_attributes.sql](supabase/migrations/20260501051546_f0778910-08ba-41d0-89f6-6011d0578495.sql) — Adds `house_rules`, `tone`, `personality`, `welcome_message`
- [20260429052457_initial_bots_schema.sql](supabase/migrations/20260429052457_913ce1a9-192e-452e-8127-6b06629f950d.sql) — Initial `bots` table with `default_instructions`, `bot_rules` table
- [20260604130023_system_bot_personas.sql](supabase/migrations/20260604130023_971eb6d8-5698-4e64-b578-7cb2d9c6eaf8.sql) — Adds `system_bot_personas` table

### Function Files
- [supabase/functions/telegram-poll/index.ts](supabase/functions/telegram-poll/index.ts) — User bot instruction injection (lines 365-430)
- [supabase/functions/lapoe-system-bot/index.ts](supabase/functions/lapoe-system-bot/index.ts) — System bot instruction injection (lines 58-100)
- [supabase/functions/_shared/context-aware-rag.ts](supabase/functions/_shared/context-aware-rag.ts) — Context awareness for prompts

### Type Definitions
- [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts) — TypeScript types for database tables

---

## 12. Current Instruction Usage Summary

✅ **Working:**
- `bots.house_rules` — Injected into user bot prompts
- `bots.default_instructions` — Injected into user bot prompts
- `bots.personality` — Injected into user bot prompts
- `system_bot_personas.house_rules` — Injected into system bot prompts

❌ **Not Implemented:**
- `bots.bot_rules` (trigger-based instructions)
- `reply_instructions` field (doesn't exist)
- System bot `default_instructions` equivalent

⚠️ **Needs Attention:**
- Instruction length limits
- Token budget management
- Inconsistency between system and user bots
