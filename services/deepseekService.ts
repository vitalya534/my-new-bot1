
export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class DeepSeekService {
  private apiUrl = 'https://api.deepseek.com/v1/chat/completions';

  public async *sendMessageStream(message: string, history: any[], systemInstruction: string) {
    const apiKey = (process.env.API_KEY || (window as any).process?.env?.API_KEY)?.trim();
    
    if (!apiKey) {
      throw new Error("API_KEY не найден в переменных окружения.");
    }

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
          ...history,
          { role: "user", content: message }
        ],
        stream: true
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(`DeepSeek API Error: ${errorMessage}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Не удалось прочитать поток ответа.");
    
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleanedLine = line.trim();
        if (!cleanedLine || !cleanedLine.startsWith('data: ')) continue;
        
        const dataStr = cleanedLine.slice(6);
        if (dataStr === '[DONE]') return;
        
        try {
          const data = JSON.parse(dataStr);
          const delta = data.choices?.[0]?.delta;
          if (!delta) continue;
          
          if (delta.reasoning_content) {
            yield { type: 'reasoning', content: delta.reasoning_content } as StreamDelta;
          }
          if (delta.content) {
            yield { type: 'content', content: delta.content } as StreamDelta;
          }
        } catch (e) {}
      }
    }
  }
}

export const deepseekService = new DeepSeekService();
