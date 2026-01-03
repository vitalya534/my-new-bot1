
export type Role = 'user' | 'model';

export interface Message {
  role: Role;
  text: string;
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
