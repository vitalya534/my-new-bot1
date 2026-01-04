
export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class DeepSeekService {
  private getEnvVar(name: string): string | undefined {
    const env = (window as any).process?.env || {};
    // Проверяем все возможные источники: глобальный process (Vite/Webpack), 
    // объект window.process (полифилл) и специфические префиксы Vercel
    return (
      (process.env?.[name]) || 
      (env[name]) || 
      (process.env?.[`NEXT_PUBLIC_${name}`]) || 
      (env[`NEXT_PUBLIC_${name}`]) ||
      (process.env?.[`VITE_${name}`]) || 
      (env[`VITE_${name}`])
    )?.trim();
  }

  private getApiUrl(): string {
    return this.getEnvVar('DEEPSEEK_API_URL') || 'https://api.deepseek.com/chat/completions';
  }

  public async *sendMessageStream(message: string, history: any[], systemInstruction: string) {
    let apiKey = this.getEnvVar('DEEPSEEK_API_KEY');
    
    // Если специализированный ключ не найден, пробуем общий API_KEY, 
    // но только если он не выглядит как ключ Gemini
    if (!apiKey) {
      const genericKey = this.getEnvVar('API_KEY');
      if (genericKey && !genericKey.startsWith('AIza')) {
        apiKey = genericKey;
      }
    }
    
    // Отладочный лог (безопасный)
    console.debug(`[DeepSeek] Using key: ${apiKey ? apiKey.substring(0, 6) + '...' : 'NOT FOUND'}`);

    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY не найден в переменных окружения Vercel.");
    }

    const response = await fetch(this.getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
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
        throw new Error(`Ошибка 401: Ключ (${apiKey.substring(0, 4)}...) недействителен или баланс DeepSeek пуст.`);
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
