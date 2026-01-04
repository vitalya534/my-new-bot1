
import { GoogleGenAI } from "@google/genai";

export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  private getEnvVar(name: string): string | undefined {
    const p = (typeof process !== 'undefined' ? process : { env: {} }) as any;
    const w = (window as any).process?.env || {};

    if (name === 'API_KEY') {
      return (
        p.env?.API_KEY || 
        w.API_KEY || 
        p.env?.NEXT_PUBLIC_API_KEY || 
        w.NEXT_PUBLIC_API_KEY ||
        p.env?.VITE_API_KEY ||
        w.VITE_API_KEY
      )?.trim();
    }
    return undefined;
  }

  private getClient() {
    const key = this.getEnvVar('API_KEY');
    if (!this.ai || (this.ai as any).apiKey !== key) {
      console.debug(`[Gemini] Initializing with key: ${key ? key.substring(0, 6) + '...' : 'NOT FOUND'}`);
      this.ai = new GoogleGenAI({ apiKey: key || '' });
    }
    return this.ai;
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
        thinkingConfig: { thinkingBudget: 32768 },
        temperature: 1,
      },
    });

    for await (const chunk of responseStream) {
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if ((part as any).thought) {
          yield { type: 'reasoning', content: (part as any).text || '' } as StreamDelta;
        } else if (part.text) {
          yield { type: 'content', content: part.text } as StreamDelta;
        }
      }
    }
  }
}

export const geminiService = new GeminiService();
