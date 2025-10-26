export interface WebhookNotification {
  stage: 'posts_inserted' | 'sentiment_complete';
  auth_user_id: string;
  request_id: string;
  post_count?: number;
  comment_count?: number;
  timestamp: string;
}

export interface ScrapeStatus {
  request_id: string;
  auth_user_id: string;
  latest_stage: 'posts_inserted' | 'sentiment_complete' | null;
  created_at: string;
}

