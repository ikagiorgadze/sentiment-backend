// Query options for filtering and pagination

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface PostQueryOptions extends QueryOptions {
  page_id?: string;
  page_url?: string;
  page_name?: string;
  full_url?: string;
  includeComments?: boolean;
  includeSentiments?: boolean;
  includeReactions?: boolean;
  includePage?: boolean;
  sentiment?: string;
  search?: string;
}

export interface CommentQueryOptions extends QueryOptions {
  post_id?: string;
  user_id?: string;
  full_url?: string;
  includeUser?: boolean;
  includePost?: boolean;
  includeSentiments?: boolean;
  includeReactions?: boolean;
}

export interface UserQueryOptions extends QueryOptions {
  fb_profile_id?: string;
  full_name?: string;
  includeComments?: boolean;
  includeReactions?: boolean;
  includeStats?: boolean;
}

export interface SentimentQueryOptions extends QueryOptions {
  post_id?: string;
  comment_id?: string;
  sentiment_category?: string;
  includePost?: boolean;
  includeComment?: boolean;
  minConfidence?: number;
  maxConfidence?: number;
  onlyPostSentiments?: boolean;      // Only sentiments where comment_id is NULL
  onlyCommentSentiments?: boolean;   // Only sentiments where comment_id is NOT NULL
}

export interface PageQueryOptions extends QueryOptions {
  page_url?: string;
  page_name?: string;
  includePostStats?: boolean;
  sentiment?: string;
}

