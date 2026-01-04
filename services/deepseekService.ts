
export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class DeepSeekService {
  // Используем предоставленный пользователем URL
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
        model: "deepseek-reasoner", // Официальное ID для модели R1 с рассуждениями
        messages: [
          { role: "system", content: systemInstruction },
          ...history,
          { role: "user", content: message }
        ],
        stream: true,
        // Температура для reasoner обычно фиксирована на стороне API, но передаем для надежности
        temperature: 0.7 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Ошибка DeepSeek API: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) return;

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
        
        const dataStr = cleanedLine.replace('data: ', '');
        if (dataStr === '[DONE]') return;
        
        try {
          const data = JSON.parse(dataStr);
          const delta = data.choices[0].delta;
          
          // Обработка блоков рассуждения (Thinking)
          if (delta.reasoning_content) {
            yield { type: 'reasoning', content: delta.reasoning_content } as StreamDelta;
          }
          // Обработка финального контента
          if (delta.content) {
            yield { type: 'content', content: delta.content } as StreamDelta;
          }
        } catch (e) {
          // Игнорируем ошибки парсинга неполных чанков
        }
      }
    }
  }
}

export const deepseekService = new DeepSeekService();
