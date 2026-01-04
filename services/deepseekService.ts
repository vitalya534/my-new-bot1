
export class DeepSeekService {
  private apiUrl = 'https://api.deepseek.com/v1/chat/completions';

  public async *sendMessageStream(message: string, history: any[], systemInstruction: string) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("MISSING_API_KEY");

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-reasoner",
        messages: [
          { role: "system", content: systemInstruction },
          ...history.map(h => ({
            role: h.role === 'model' ? 'assistant' : h.role,
            content: h.parts[0].text
          })),
          { role: "user", content: message }
        ],
        stream: true,
        max_tokens: 4096
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.replace('data: ', '');
          if (dataStr === '[DONE]') return;
          
          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices[0].delta;
            
            // DeepSeek R1 specific fields
            if (delta.reasoning_content) {
              yield { type: 'reasoning', content: delta.reasoning_content };
            }
            if (delta.content) {
              yield { type: 'content', content: delta.content };
            }
          } catch (e) {
            console.error("Error parsing stream chunk", e);
          }
        }
      }
    }
  }
}

export const deepseekService = new DeepSeekService();
