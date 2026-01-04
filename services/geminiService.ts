
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const MODEL_NAME = 'gemini-3-pro-preview';

export class GeminiService {
  private currentInstruction: string = "";

  public initChat(systemInstruction: string) {
    // Adding global reasoning requirement to match DeepSeek R1 style
    this.currentInstruction = `${systemInstruction} ALWAYS use step-by-step reasoning. Be extremely analytical and precise. Even for simple questions, ensure your internal logic is sound.`;
  }

  public async *sendMessageStream(message: string, history: { role: string, parts: { text: string }[] }[] = []) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("MISSING_API_KEY");
    }

    // New instance per call to ensure we pick up fresh API keys from the session
    const ai = new GoogleGenAI({ apiKey });
    
    try {
      const chat = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: this.currentInstruction,
          temperature: 0.7, // Lower temperature for more stable reasoning
          // Max thinking budget for deep chain-of-thought processing
          thinkingConfig: { thinkingBudget: 32768 }
        },
        history: history
      });

      const result = await chat.sendMessageStream({ message });
      for await (const chunk of result) {
        const response = chunk as GenerateContentResponse;
        const text = response.text;
        if (text) yield text;
      }
    } catch (error: any) {
      console.error("Gemini Reasoning Error:", error);
      if (error.message?.includes('403') || error.message?.includes('not found') || error.message?.includes('API_KEY')) {
        throw new Error("AUTH_ERROR");
      }
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
