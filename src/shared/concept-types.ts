export interface ConceptMetadata {
  created_at: string;
  updated_at: string;
  author: string;
  tags: string[];
  difficulty: '简单' | '中等' | '困难';
  category: string;
}

export interface ConceptData {
  name: string;
  description: string;
  content: string;
  metadata: ConceptMetadata;
}

export interface ConceptQueryResult {
  exists: boolean;
  data?: ConceptData;
  generated?: boolean;
}
