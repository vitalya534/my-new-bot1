
export type Role = 'user' | 'assistant';

export interface Message {
  role: Role;
  text: string;
  reasoning?: string; // For DeepSeek R1 thought process
  timestamp: number;
}

export interface Personality {
  id: string;
  name: string;
  emoji: string;
  description: string;
  instruction: string;
  color: string;
}
