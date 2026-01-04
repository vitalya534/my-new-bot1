
import { GoogleGenAI } from "@google/genai";

export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  private getEnvVar(name: string): string | undefined {
    const env = (window as any).process?.env || {};
    return (
      (process.env?.[name]) || 
      (env[name]) || 
      (process.env?.[`NEXT_PUBLIC_${name}`]) || 
      (env[`NEXT_PUBLIC_${name}`]) ||
      (process.env?.[`VITE_${name}`]) || 
      (env[`VITE_${name}`])
    )?.trim();
  }

  private getClient() {
    if (!this.ai) {
      const key = this.getEnvVar('API_KEY');
      console.debug(`[Gemini] Using key: ${key ? key.substring(0, 6) + '...' : 'NOT FOUND'}`);
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
