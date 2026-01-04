
export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class DeepSeekService {
  private getApiUrl(): string {
    const env = (window as any).process?.env || {};
    const customUrl = (process.env?.DEEPSEEK_API_URL || env.DEEPSEEK_API_URL)?.trim();
    return customUrl || 'https://api.deepseek.com/chat/completions';
  }

  public async *sendMessageStream(message: string, history: any[], systemInstruction: string) {
    const env = (window as any).process?.env || {};
    
    // Приоритетное использование специализированной переменной DEEPSEEK_API_KEY
    let apiKey = (process.env?.DEEPSEEK_API_KEY || env.DEEPSEEK_API_KEY)?.trim();
    
    if (!apiKey) {
      const genericKey = (process.env?.API_KEY || env.API_KEY)?.trim();
      // Проверка, чтобы не использовать ключ Gemini для запросов к DeepSeek
      if (genericKey && !genericKey.startsWith('AIza')) {
        apiKey = genericKey;
      }
    }
    
    if (!apiKey) {
      throw new Error("Ключ DEEPSEEK_API_KEY не обнаружен. Проверьте настройки окружения.");
    }

    const response = await fetch(this.getApiUrl(), {
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
        throw new Error("Ошибка 401: DEEPSEEK_API_KEY невалиден или баланс на платформе DeepSeek пуст.");
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
