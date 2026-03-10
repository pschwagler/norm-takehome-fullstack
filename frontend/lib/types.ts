export interface Citation {
  source: string;
  text: string;
  document_name?: string;
  jurisdiction?: string;
}

export interface QueryRequest {
  query: string;
  jurisdiction?: string;
  thread_id?: number;
}

export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface ThreadSummary {
  id: number;
  title: string;
  jurisdiction: string | null;
  message_count: number;
  created_at: string;
}

export interface ThreadDetail {
  id: number;
  title: string;
  jurisdiction: string | null;
  messages: Message[];
  created_at: string;
}

export interface ActiveMessage {
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  isStreaming: boolean;
}

export interface LawResponse {
  id: number;
  section: string;
  topic: string;
  section_title: string | null;
  text: string;
  jurisdiction: string;
  legislation_id: number;
}

export interface LawGroup {
  topic: string;
  section_title: string | null;
  laws: LawResponse[];
}

export interface LegislationResponse {
  id: number;
  name: string;
  file_name: string;
  jurisdiction: string;
  laws_count: number;
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface LegislationUploadResponse {
  id: number;
  name: string;
  file_name: string;
  laws_count: number;
  uploaded_at: string;
}

export interface HealthResponse {
  status: string;
  legislation_loaded: number;
  laws_indexed: number;
}

export const JURISDICTIONS = [
  'Kingdom-wide',
  'The North',
  'The Reach',
  'The Vale',
  'The Westerlands',
  'The Riverlands',
  'The Stormlands',
  'Dorne',
  'The Iron Islands',
  'The Crownlands',
  "King's Landing",
  'Oldtown',
  'Lannisport',
  'White Harbor',
] as const;
