export interface Citation {
  source: string;
  text: string;
  document_name?: string;
  jurisdiction?: string;
}

export interface QueryRequest {
  query: string;
  jurisdiction?: string;
}

export interface ConversationSummary {
  id: number;
  query: string;
  jurisdiction: string | null;
  created_at: string;
}

export interface ConversationDetail {
  id: number;
  query: string;
  response: string;
  citations: Citation[];
  jurisdiction: string | null;
  created_at: string;
}

export interface LawResponse {
  id: number;
  section: string;
  topic: string;
  section_title: string | null;
  text: string;
  jurisdiction: string;
  document_id: number;
}

export interface LawGroup {
  topic: string;
  section_title: string | null;
  laws: LawResponse[];
}

export interface DocumentResponse {
  id: number;
  name: string;
  file_name: string;
  jurisdiction: string;
  laws_count: number;
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface DocumentUploadResponse {
  id: number;
  name: string;
  file_name: string;
  laws_count: number;
  uploaded_at: string;
}

export interface HealthResponse {
  status: string;
  documents_loaded: number;
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
