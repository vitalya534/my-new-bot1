
import { GoogleGenAI } from "@google/genai";

export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  private getClient() {
    if (!this.ai) {
      // In this context, process.env.API_KEY is the preferred source
      const key = (process.env.API_KEY || (window as any).process?.env?.API_KEY)?.trim();
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

    // Using gemini-3-pro-preview as the primary competitor to DeepSeek R1 for reasoning tasks
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: contents as any,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 32768 }, // Maximum budget for gemini-3-pro-preview
        temperature: 1,
      },
    });

    for await (const chunk of responseStream) {
      // Handle the response parts manually to separate thinking from final output
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
