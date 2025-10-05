# YAML Parse Error Fix

## Problem
The YAML parse error was caused by malformed YAML in the dialogue journal files. The reasoning content contained newlines and special characters that weren't properly handled in YAML format.

## Root Cause
1. **Multi-line reasoning content**: AI reasoning contained newlines and special characters
2. **Improper YAML formatting**: Long strings were stored as quoted strings instead of literal blocks
3. **Corrupted YAML file**: The conversation file became malformed with unclosed quotes

## Solution

### 1. **Enhanced YAML String Handling**
```typescript
// Handle multi-line strings with YAML literal block notation
if (value.includes('\n') || value.length > 100) {
    lines.push(`${indent}${key}: |`);
    const escapedLines = value.split('\n').map(line => this.escapeYAMLString(line));
    escapedLines.forEach(line => lines.push(`${indent}  ${line}`));
} else {
    // Single line strings - use quoted format
    const escaped = this.escapeYAMLString(value);
    lines.push(`${indent}${key}: "${escaped}"`);
}
```

### 2. **YAML Literal Block Notation**
- Multi-line strings now use `|` (literal block) instead of quoted strings
- Each line is properly indented and escaped
- Prevents YAML parsing errors with newlines and special characters

### 3. **Cleaned Corrupted Files**
- Removed corrupted YAML files
- Server will recreate clean conversation files

## Result
- Reasoning content is now properly stored in YAML format
- No more "Expected character" parse errors
- Multi-line reasoning content displays correctly
- Conversation history persists without corruption

## Test
The reasoning display should now work without YAML errors:
```bash
> reasoning on
✅ Reasoning enabled - AI thinking process will be displayed in real-time

> tell me a joke
[AI thinking in gray text - properly formatted]
[AI response in normal color]
```
