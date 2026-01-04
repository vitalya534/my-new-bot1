
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const MODEL_NAME = 'gemini-3-pro-preview';

export class GeminiService {
  private currentInstruction: string = "";

  public initChat(systemInstruction: string) {
    // Force the model to adopt the DeepSeek persona and use its internal reasoning tokens effectively
    this.currentInstruction = `${systemInstruction} You are DeepSeek-R1. You must provide extensive internal reasoning before giving the final answer. Structure your thoughts clearly.`;
  }

  public async *sendMessageStream(message: string, history: { role: string, parts: { text: string }[] }[] = []) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("MISSING_API_KEY");
    }

    // Always create a new instance to ensure we use the latest available key from the environment/dialog
    const ai = new GoogleGenAI({ apiKey });
    
    try {
      const chat = ai.chats.create({
        model: MODEL_NAME,
        config: {
          systemInstruction: this.currentInstruction,
          temperature: 0.6, // Optimal for reasoning models
          // Enable maximum reasoning capacity to match DeepSeek R1's "Thought" blocks
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
      console.error("DeepSeek Reasoning Engine Error:", error);
      // Handle the specific error that requires re-authentication
      if (error.message?.includes('Requested entity was not found') || error.message?.includes('403')) {
        throw new Error("AUTH_ERROR");
      }
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
