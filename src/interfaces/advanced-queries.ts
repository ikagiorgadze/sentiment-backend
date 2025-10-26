// Advanced query options for complex joins and filters

export interface PostAnalyticsOptions {
  includeCommentCount?: boolean;
  includeSentimentCount?: boolean;
  includeReactionCount?: boolean;
  includeUniqueCommenters?: boolean;
}

export interface CommentAnalyticsOptions {
  includeSentiment?: boolean;
  includeReactionCount?: boolean;
}

export interface UserActivityOptions {
  postId?: string;
  includeCommentCount?: boolean;
  includeReactionCount?: boolean;
}

export interface SentimentFilterOptions {
  onlyPostSentiments?: boolean;      // Only sentiments where comment_id is NULL
  onlyCommentSentiments?: boolean;   // Only sentiments where comment_id is NOT NULL
}





