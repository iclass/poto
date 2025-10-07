# Reasoning Commands in ChatClient

The ChatClient already supports reasoning toggle commands for Doubao and other reasoning-enabled models. Here's how to use them:

## Available Commands

### 1. **Check Reasoning Status**
```
reasoning
```
Shows whether reasoning is currently enabled or disabled.

### 2. **Enable Reasoning**
```
reasoning on
```
Enables reasoning mode. When enabled:
- The AI's thinking process will be displayed in gray text
- Main responses will be displayed in AI color
- Works with Doubao models and other reasoning-enabled models

### 3. **Disable Reasoning**
```
reasoning off
```
Disables reasoning mode. Returns to normal text-only streaming.

### 4. **View All Commands**
```
help
```
Shows all available commands including reasoning commands.

## Usage Example

```bash
# Start the chat client
bun run start-client

# Check current reasoning status
> reasoning
🧠 Reasoning: disabled

# Enable reasoning for Doubao models
> reasoning on
✅ Reasoning enabled (reasoning content will be silently ignored)

# Now when you chat, you'll see the AI's thinking process
> What is the capital of France?
[AI thinking process in gray text]
The capital of France is Paris.

# Disable reasoning
> reasoning off
✅ Reasoning disabled
```

## How It Works

1. **When reasoning is enabled**: The client automatically uses `DataPacket` streaming
2. **Reasoning content**: Displayed in gray color (configurable via `color reasoning <color>`)
3. **Main content**: Displayed in AI color
4. **Real-time streaming**: Both reasoning and content stream in real-time
5. **Interruption support**: Ctrl+C works during both reasoning and content streaming

## Model Support

The reasoning commands work with any model that supports reasoning content, including:
- **Doubao models**: Full reasoning support with `reasoning_content` field
- **GPT-5 models**: When reasoning is enabled via the LLM configuration
- **Other reasoning-enabled models**: As supported by the model's API

## Configuration

You can customize the reasoning display color:
```
color reasoning gray        # Default gray
color reasoning brightBlue  # Bright blue
color reasoning magenta     # Magenta
```

## Integration with DataPacket

The reasoning system is fully integrated with `DataPacket`:
- **Source**: Identifies the origin (e.g., 'llm', 'user', 'system')
- **Reasoning**: Contains the AI's thinking process
- **Content**: Contains the main response
- **Real-time streaming**: Both fields stream independently

This provides a complete reasoning display system for Doubao and other reasoning-enabled models!
