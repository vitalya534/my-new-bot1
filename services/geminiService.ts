
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { Message } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

export class GeminiService {
  private ai: GoogleGenAI;
  private chat: Chat | null = null;

  constructor() {
    const apiKey = process.env.API_KEY || '';
    this.ai = new GoogleGenAI({ apiKey });
  }

  public initChat(systemInstruction: string, history: Message[] = []) {
    this.chat = this.ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction,
        temperature: 0.8,
        topP: 0.95,
      },
      // Maps internal Message type to Gemini's expected format if needed
      // For simplicity, we start fresh or manage history locally
    });
  }

  public async *sendMessageStream(message: string) {
    if (!this.chat) {
      throw new Error("Chat not initialized");
    }

    const result = await this.chat.sendMessageStream({ message });
    
    for await (const chunk of result) {
      const response = chunk as GenerateContentResponse;
      yield response.text;
    }
  }
}

export const geminiService = new GeminiService();
