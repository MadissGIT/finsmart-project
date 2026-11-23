export interface Article {
  id: string;
  title: string;
  category: string;
  read_time_min: number;
  summary: string;
  content_markdown: string;
  action_checklist: string[];
  tags: string[];
}
