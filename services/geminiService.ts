
import { GoogleGenAI } from "@google/genai";

export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class GeminiService {
  // Согласно инструкции: всегда используем новый экземпляр перед вызовом
  private getClient() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  public async *sendMessageStream(message: string, history: any[], systemInstruction: string) {
    const ai = this.getClient();
    
    // Преобразование истории в формат Gemini
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
        // Максимальный бюджет для глубокого рассуждения (thinking)
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    for await (const chunk of responseStream) {
      // Получаем текст напрямую через свойство .text согласно правилам
      const text = chunk.text;
      
      // Извлекаем мысли (thought process) из частей ответа
      // В Gemini 3 "мысли" приходят как часть контента с полем thought
      const thoughtPart = chunk.candidates?.[0]?.content?.parts?.find((p: any) => p.thought);
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
