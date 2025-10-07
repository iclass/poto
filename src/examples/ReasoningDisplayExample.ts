import { PotoModule } from "../server/PotoModule";
import { PotoUser } from "../server/UserProvider";
import { DataPacket } from "../shared/DataPacket";
import { generatorToSseStream } from "../shared/CommonTypes";

/**
 * Example module demonstrating reasoning display with DataPacket
 * Shows how to stream both content and reasoning to the frontend
 */
export class ReasoningDisplayExample extends PotoModule {
	getRoute(): string {
		return "reasoning-example";
	}

	/**
	 * Example chat endpoint that streams both content and reasoning
	 * The frontend can display both the main response and the AI's reasoning process
	 */
	async postChatWithReasoning_(message: string, user: PotoUser): Promise<ReadableStream<Uint8Array>> {
		async function* reasoningStream() {
			// This would typically call the LLMPotoModule's chatWithReasoning method
			// For this example, we'll simulate the streaming behavior
			
			// Simulate reasoning content
			const reasoningSteps = [
				"Let me think about this question...",
				"I need to consider the context and provide a helpful response.",
				"Based on the user's question, I should structure my answer clearly.",
				"Now I'll formulate my response."
			];
			
			// Simulate main content
			const contentParts = [
				"Hello! ",
				"I understand your question about ",
				"`" + message + "`. ",
				"Let me provide you with a comprehensive answer...",
				"\n\nHere's what I think:",
				"\n\n1. First, let's consider the main points",
				"\n2. Then we can explore the details",
				"\n3. Finally, I'll provide some practical advice",
				"\n\nI hope this helps! Let me know if you need clarification."
			];
			
			// Stream reasoning first
			for (let i = 0; i < reasoningSteps.length; i++) {
				yield new DataPacket('llm', reasoningSteps[i], '');
				// Simulate processing time
				await new Promise(resolve => setTimeout(resolve, 200));
			}
			
			// Then stream content
			for (let i = 0; i < contentParts.length; i++) {
				yield new DataPacket('llm', '', contentParts[i]);
				// Simulate processing time
				await new Promise(resolve => setTimeout(resolve, 100));
			}
			
			// Final packet to indicate completion
			yield new DataPacket('llm', 'Response complete!', '');
		}

		return generatorToSseStream(reasoningStream());
	}

	/**
	 * Example of how to handle the streaming response on the frontend
	 * This would be implemented in JavaScript/TypeScript on the client side
	 */
	getFrontendExample(): string {
		return `
<!DOCTYPE html>
<html>
<head>
    <title>Reasoning Display Example</title>
    <style>
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .reasoning { 
            background: #f0f8ff; 
            border-left: 4px solid #007acc; 
            padding: 10px; 
            margin: 10px 0; 
            font-style: italic; 
            color: #666;
        }
        .content { 
            background: #f9f9f9; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 10px 0;
        }
        .error { 
            background: #ffe6e6; 
            color: #cc0000; 
            padding: 10px; 
            border-radius: 5px; 
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>AI Chat with Reasoning Display</h1>
        <div id="chat-container"></div>
        <input type="text" id="message-input" placeholder="Ask a question..." style="width: 100%; padding: 10px;">
        <button onclick="sendMessage()">Send</button>
    </div>

    <script>
        async function sendMessage() {
            const input = document.getElementById('message-input');
            const message = input.value.trim();
            if (!message) return;
            
            input.value = '';
            addMessage('user', message);
            
            try {
                const response = await fetch('/api/reasoning-example/chat-with-reasoning', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });
                
                if (!response.ok) throw new Error('Network error');
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                
                let reasoningElement = null;
                let contentElement = null;
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                const packet = {
                                    source: data.source,
                                    reasoning: data.reasoning,
                                    content: data.content
                                };
                                
                                // Handle reasoning content
                                if (packet.reasoning) {
                                    if (!reasoningElement) {
                                        reasoningElement = document.createElement('div');
                                        reasoningElement.className = 'reasoning';
                                        reasoningElement.innerHTML = '<strong>AI Reasoning:</strong><br>';
                                        document.getElementById('chat-container').appendChild(reasoningElement);
                                    }
                                    reasoningElement.innerHTML += packet.reasoning + ' ';
                                }
                                
                                // Handle main content
                                if (packet.content) {
                                    if (!contentElement) {
                                        contentElement = document.createElement('div');
                                        contentElement.className = 'content';
                                        document.getElementById('chat-container').appendChild(contentElement);
                                    }
                                    contentElement.innerHTML += packet.content;
                                }
                                
                                // Handle errors
                                if (packet.source === 'error') {
                                    addError(packet.content);
                                }
                            } catch (e) {
                                console.error('Error parsing SSE data:', e);
                            }
                        }
                    }
                }
            } catch (error) {
                addError('Error: ' + error.message);
            }
        }
        
        function addMessage(role, content) {
            const container = document.getElementById('chat-container');
            const div = document.createElement('div');
            div.className = role === 'user' ? 'content' : 'reasoning';
            div.innerHTML = '<strong>' + (role === 'user' ? 'You' : 'AI') + ':</strong> ' + content;
            container.appendChild(div);
        }
        
        function addError(message) {
            const container = document.getElementById('chat-container');
            const div = document.createElement('div');
            div.className = 'error';
            div.innerHTML = message;
            container.appendChild(div);
        }
        
        // Allow Enter key to send message
        document.getElementById('message-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
</body>
</html>
		`;
	}
}
