
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";

const MODEL_NAME = 'gemini-3-flash-preview';

export class GeminiService {
  private currentInstruction: string = "";

  public initChat(systemInstruction: string) {
    this.currentInstruction = systemInstruction;
  }

  public async *sendMessageStream(message: string, history: { role: string, parts: { text: string }[] }[] = []) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("MISSING_API_KEY");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // We create a fresh chat instance for each stream to ensure we use the current API Key
    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: this.currentInstruction,
        temperature: 0.8,
      },
      history: history
    });

    try {
      const result = await chat.sendMessageStream({ message });
      for await (const chunk of result) {
        const response = chunk as GenerateContentResponse;
        const text = response.text;
        if (text) yield text;
      }
    } catch (error: any) {
      console.error("Gemini service error:", error);
      if (error.message?.includes('403') || error.message?.includes('not found')) {
        throw new Error("AUTH_ERROR");
      }
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
