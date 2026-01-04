
export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class DeepSeekService {
  private apiUrl = 'https://api.deepseek.com/chat/completions';

  public async *sendMessageStream(message: string, history: any[], systemInstruction: string) {
    const apiKey = (
      (typeof process !== 'undefined' && (process.env?.DEEPSEEK_API_KEY || process.env?.API_KEY)) || 
      (window as any).process?.env?.DEEPSEEK_API_KEY || 
      (window as any).process?.env?.API_KEY ||
      (import.meta as any).env?.VITE_DEEPSEEK_API_KEY ||
      (import.meta as any).env?.VITE_API_KEY
    )?.trim();
    
    if (!apiKey) {
      throw new Error("API_KEY не обнаружен. Проверьте настройки Environment Variables.");
    }

    if (apiKey.startsWith('AIza')) {
      throw new Error("Вы пытаетесь использовать ключ Google Gemini для DeepSeek. Это разные сервисы. Пожалуйста, переключитесь на движок Gemini в заголовке или добавьте ключ от DeepSeek.");
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
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch (e) {}
      
      if (response.status === 401) {
        throw new Error(`Ошибка авторизации (401): Ключ не принят DeepSeek. Убедитесь, что ваш ключ корректен и баланс пополнен на api.deepseek.com.`);
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
