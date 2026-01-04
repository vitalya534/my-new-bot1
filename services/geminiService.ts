
import { GoogleGenAI } from "@google/genai";

export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class GeminiService {
  private getClient() {
    // Используем строго предоставленный ключ окружения
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  public async *sendMessageStream(message: string, history: any[], systemInstruction: string) {
    const ai = this.getClient();
    
    const contents = [
      ...history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: contents as any,
      config: {
        systemInstruction: systemInstruction,
        // Активируем режим рассуждения (аналог DeepSeek R1)
        thinkingConfig: { thinkingBudget: 32768 },
        temperature: 1,
      },
    });

    for await (const chunk of responseStream) {
      // Извлекаем текст ответа
      const text = chunk.text;
      
      // Извлекаем части с размышлениями (thought)
      const thoughtPart = chunk.candidates?.[0]?.content?.parts?.find((p: any) => 'thought' in p);
      const thought = thoughtPart ? (thoughtPart as any).thought : null;
      
      if (thought) {
        yield { type: 'reasoning', content: thought };
      }
      
      if (text) {
        yield { type: 'content', content: text };
      }
    }
  }
}

export const geminiService = new GeminiService();
