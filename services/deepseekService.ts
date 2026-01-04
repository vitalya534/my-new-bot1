
export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class DeepSeekService {
  private getApiKey(): string {
    // Согласно инструкции, используем исключительно process.env.API_KEY
    return (process.env.API_KEY || '').trim();
  }

  private getApiUrl(): string {
    // Используем базовый URL для DeepSeek или прокси, если настроен
    return 'https://api.deepseek.com/chat/completions';
  }

  public async *sendMessageStream(message: string, history: any[], systemInstruction: string) {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      throw new Error("API_KEY не найден в переменных окружения.");
    }

    const response = await fetch(this.getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-reasoner", // Используем R1 (reasoner) для глубоких размышлений
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
      throw new Error(`Ошибка API (${response.status}): ${errorText || response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Не удалось прочитать поток данных.");
    
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
          
          // Обработка процесса размышления (R1)
          if (delta.reasoning_content) {
            yield { type: 'reasoning', content: delta.reasoning_content };
          }
          // Обработка основного контента
          if (delta.content) {
            yield { type: 'content', content: delta.content };
          }
        } catch (e) {
          // Игнорируем ошибки парсинга неполных чанков
        }
      }
    }
  }
}

export const deepseekService = new DeepSeekService();
