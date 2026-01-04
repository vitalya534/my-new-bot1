
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";

const MODEL_NAME = 'gemini-3-flash-preview';

export class GeminiService {
  private chat: Chat | null = null;
  private currentInstruction: string = "";

  public initChat(systemInstruction: string) {
    this.currentInstruction = systemInstruction;
    this.chat = null; // Reset chat to force re-initialization with new instruction
  }

  private ensureChat() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY is not configured in the environment.");
    }

    const ai = new GoogleGenAI({ apiKey });
    this.chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: this.currentInstruction,
        temperature: 0.7,
      },
    });
    return this.chat;
  }

  public async *sendMessageStream(message: string) {
    try {
      const chat = this.chat || this.ensureChat();
      const result = await chat.sendMessageStream({ message });
      
      for await (const chunk of result) {
        const response = chunk as GenerateContentResponse;
        const text = response.text;
        if (text) yield text;
      }
    } catch (error: any) {
      console.error("Gemini stream error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
