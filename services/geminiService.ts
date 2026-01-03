
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { Message } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private chat: Chat | null = null;

  private getAI() {
    // Re-instantiate or ensure AI exists with current environment key
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("API_KEY is missing from process.env");
    }
    return new GoogleGenAI({ apiKey: apiKey || '' });
  }

  public initChat(systemInstruction: string, history: Message[] = []) {
    const ai = this.getAI();
    this.chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction,
        temperature: 0.8,
        topP: 0.95,
      },
    });
  }

  public async *sendMessageStream(message: string) {
    if (!this.chat) {
      throw new Error("Chat not initialized. Call initChat first.");
    }

    const result = await this.chat.sendMessageStream({ message });
    
    for await (const chunk of result) {
      const response = chunk as GenerateContentResponse;
      yield response.text;
    }
  }
}

export const geminiService = new GeminiService();
