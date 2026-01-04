
import { GoogleGenAI, Modality } from "@google/genai";

export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class GeminiService {
  // Инициализируем согласно правилам: всегда через новый экземпляр перед вызовом или по требованию
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
        // Включаем "мышление" для Pro модели
        thinkingConfig: { thinkingBudget: 16000 },
        temperature: 1,
      },
    });

    for await (const chunk of responseStream) {
      // Согласно документации, получаем текст напрямую через свойство .text
      const text = chunk.text;
      
      // Попытка извлечь "мысли", если они приходят в специфических полях для Gemini 3
      // В текущем SDK мысли обычно предшествуют тексту в потоке или находятся в candidates
      const thought = (chunk as any).candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.thought;
      
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
