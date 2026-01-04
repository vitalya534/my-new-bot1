
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

export interface StreamDelta {
  type: 'reasoning' | 'content';
  content: string;
}

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  private getClient() {
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    }
    return this.ai;
  }

  public async *sendMessageStream(message: string, history: any[], systemInstruction: string) {
    const ai = this.getClient();
    
    // Transform history to Gemini format
    const contents = [
      ...history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: contents as any,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 4000 }, // Enable reasoning tokens
        temperature: 1,
      },
    });

    for await (const chunk of responseStream) {
      const c = chunk as any;
      // In Gemini 3, thinking is often delivered in parts with a specific trait
      // or as a distinct 'thought' property depending on the exact SDK version/API state.
      // Based on current standards, we check for 'thought' or specific part types.
      
      const parts = c.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.thought) {
          yield { type: 'reasoning', content: part.text || '' } as StreamDelta;
        } else if (part.text) {
          // If the model is in thinking mode, earlier text parts might be thinking 
          // but usually they are distinct.
          yield { type: 'content', content: part.text } as StreamDelta;
        }
      }
    }
  }
}

export const geminiService = new GeminiService();
