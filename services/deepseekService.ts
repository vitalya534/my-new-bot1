
export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class DeepSeekService {
  private getEnvVar(name: string): string | undefined {
    // Явный доступ по именам помогает бандлерам (Vite/Next.js/Webpack)
    // подставлять значения на этапе сборки.
    const p = (typeof process !== 'undefined' ? process : { env: {} }) as any;
    const w = (window as any).process?.env || {};

    if (name === 'DEEPSEEK_API_KEY') {
      return (
        p.env?.DEEPSEEK_API_KEY || 
        w.DEEPSEEK_API_KEY || 
        p.env?.NEXT_PUBLIC_DEEPSEEK_API_KEY || 
        w.NEXT_PUBLIC_DEEPSEEK_API_KEY ||
        p.env?.VITE_DEEPSEEK_API_KEY ||
        w.VITE_DEEPSEEK_API_KEY
      )?.trim();
    }

    if (name === 'DEEPSEEK_API_URL') {
      return (
        p.env?.DEEPSEEK_API_URL || 
        w.DEEPSEEK_API_URL || 
        p.env?.NEXT_PUBLIC_DEEPSEEK_API_URL || 
        p.env?.VITE_DEEPSEEK_API_URL
      )?.trim();
    }

    if (name === 'API_KEY') {
      return (
        p.env?.API_KEY || 
        w.API_KEY || 
        p.env?.NEXT_PUBLIC_API_KEY || 
        p.env?.VITE_API_KEY
      )?.trim();
    }

    return undefined;
  }

  private getApiUrl(): string {
    return this.getEnvVar('DEEPSEEK_API_URL') || 'https://api.deepseek.com/chat/completions';
  }

  public async *sendMessageStream(message: string, history: any[], systemInstruction: string) {
    let apiKey = this.getEnvVar('DEEPSEEK_API_KEY');
    
    // Попытка использовать универсальный API_KEY, если DeepSeek-специфичный не задан
    if (!apiKey) {
      const genericKey = this.getEnvVar('API_KEY');
      // Используем только если это не ключ Gemini (те начинаются с AIza)
      if (genericKey && !genericKey.startsWith('AIza')) {
        apiKey = genericKey;
      }
    }
    
    // Логируем только факт наличия ключа
    console.debug(`[DeepSeek] API Key detected: ${apiKey ? 'YES (starts with ' + apiKey.substring(0,4) + ')' : 'NO'}`);

    if (!apiKey) {
      throw new Error("API ключ DeepSeek не найден. Убедитесь, что вы добавили DEEPSEEK_API_KEY в Environment Variables на Vercel и перезапустили Deployment.");
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
        throw new Error(`Ошибка 401: Ключ (${apiKey.substring(0, 4)}...) не авторизован. Проверьте баланс на deepseek.com.`);
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
