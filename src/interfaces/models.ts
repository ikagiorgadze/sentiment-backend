// Database model interfaces

export interface User {
  id: string;
  fb_profile_id: string | null;
  full_name: string | null;
  inserted_at: Date;
}

export interface Page {
  id: string;
  page_url: string | null;
  page_name: string | null;
  inserted_at: Date;
}

export interface PageWithStats extends Page {
  post_count?: number;
  last_post_at?: Date | null;
  comment_count?: number;
  reaction_count?: number;
  engagement_score?: number;
  sentiment_summary?: {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    average_polarity: number | null;
  };
}

export interface Post {
  id: string;
  page_id: string | null;
  full_url: string | null;
  content: string | null;
  posted_at?: Date | null;
  inserted_at: Date;
  page?: Page;
}

export interface Comment {
  id: string;
  full_url: string | null;
  post_id: string | null;
  user_id: string | null;
  content: string | null;
  posted_at?: Date | null;
  inserted_at: Date;
}

export interface Sentiment {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  sentiment: string | null;
  sentiment_category: string | null;
  confidence: number | null;
  probabilities: Record<string, any> | null;
  polarity: number | null;
  inserted_at: Date;
}

export interface Reaction {
  id: string;
  user_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  reaction_type: 'like' | 'love' | 'sad' | 'angry' | 'haha' | 'wow' | null;
  inserted_at: Date;
}

export interface Job {
  job_id: string;
  idempotency_key: string;
  resource_key: string;
  job_type: string;
  payload_json: Record<string, any>;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  error: string | null;
}

// Extended interfaces with joined data
export interface PostWithDetails extends Post {
  comments?: CommentWithDetails[];
  sentiments?: Sentiment[];
  reactions?: Reaction[];
  comment_count?: number;
  reaction_count?: number;
  engagement_score?: number;
}

export interface CommentWithDetails extends Comment {
  user?: User;
  post?: Post;
  sentiments?: Sentiment[];
  reactions?: Reaction[];
}

export interface UserWithDetails extends User {
  comments?: Comment[];
  reactions?: Reaction[];
  comment_count?: number;
  reaction_count?: number;
  stats?: {
    total_comments: number;
    posts_commented: number;
    total_reactions: number;
    sentiment_breakdown: {
      positive: number;
      neutral: number;
      negative: number;
      total: number;
      average_polarity: number | null;
    };
    top_pages: Array<{
      page_id: string | null;
      page_name: string | null;
      comment_count: number;
      sentiment_breakdown: {
        positive: number;
        neutral: number;
        negative: number;
        total: number;
        average_polarity: number | null;
      };
    }>;
  };
}

export interface SentimentWithDetails extends Sentiment {
  post?: Post;
  comment?: Comment;
}





