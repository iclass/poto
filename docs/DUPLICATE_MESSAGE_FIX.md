# Duplicate Message Fix

## Problem
The user message was being sent twice to the LLM because:

1. **User message was added to dialogue journal** before calling the streaming method
2. **Conversation history was loaded** from the dialogue journal (including the user message)
3. **Current message was added again** in the streaming method
4. **Result**: User message appeared twice in the request

## Root Cause
```typescript
// BEFORE (causing duplication):
// 1. Add user message to journal
await this.dialogueJournal.addMessage(user, { role: 'user', content: message });

// 2. Load history (includes the user message we just added)
const history = await this.dialogueJournal.getConversation(user);

// 3. Call streaming method with message + history (duplicate!)
streamLLMWithSimplePackets(message, history, options);
```

## Solution
```typescript
// AFTER (fixed):
// 1. Load history (without the current message)
const history = await this.dialogueJournal.getConversation(user);

// 2. Call streaming method with message + history (no duplicate)
streamLLMWithSimplePackets(message, history, options);

// 3. Add both user and AI messages to journal after response
await this.dialogueJournal.addMessage(user, { role: 'user', content: message });
await this.dialogueJournal.addMessage(user, { role: 'assistant', content: aiResponse });
```

## Result
- ✅ User message sent only once to LLM
- ✅ Conversation history properly maintained
- ✅ Both user and AI messages saved to journal
- ✅ No duplicate messages in request body

## Test
The request body should now show the user message only once:
```json
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "say hi"}  // Only once!
  ]
}
```
