export type Tone = 'balanced' | 'descriptive' | 'direct' | 'epic' | 'dark' | 'dramatic';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelType?: 'rapid' | 'prime';
  isPinned?: boolean;
  imageUrl?: string;
}

export interface WritingConfig {
  style: string;
  genre: string;
  perspective: string;
}

export interface MemoryEntry {
  id: string;
  category: 'character' | 'plot' | 'world' | 'event';
  name: string;
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  notes?: string;
  memoryEntries?: MemoryEntry[];
  tone?: Tone;
  writingConfig?: WritingConfig;
}
