import { AnalyticsRepository } from '../repositories/analytics.repository';
import { QueryOptions } from '../interfaces/query-options';

export class AnalyticsService {
  private analyticsRepository: AnalyticsRepository;

  constructor() {
    this.analyticsRepository = new AnalyticsRepository();
  }

  async getUsersByPostId(postId: string, userId: string, role: string, options: QueryOptions = {}) {
    return this.analyticsRepository.getUsersByPostId(postId, userId, role, options);
  }

  async getPostsByUserId(targetUserId: string, userId: string, role: string, options: QueryOptions = {}) {
    return this.analyticsRepository.getPostsByUserId(targetUserId, userId, role, options);
  }

  async getPostSentiments(postId: string, userId: string, role: string) {
    return this.analyticsRepository.getPostSentiments(postId, userId, role);
  }

  async getCommentSentimentsByPostId(postId: string, userId: string, role: string) {
    return this.analyticsRepository.getCommentSentimentsByPostId(postId, userId, role);
  }

  async getPostSentimentSummary(postId: string, userId: string, role: string) {
    return this.analyticsRepository.getPostSentimentSummary(postId, userId, role);
  }

  async getCommentsWithSentiment(postId: string | undefined, userId: string, role: string, options: QueryOptions = {}) {
    return this.analyticsRepository.getCommentsWithSentiment(postId, userId, role, options);
  }

  async getUserActivityOnPost(targetUserId: string, postId: string, userId: string, role: string) {
    return this.analyticsRepository.getUserActivityOnPost(targetUserId, postId, userId, role);
  }

  async getDashboardStats(userId: string, role: string) {
    return this.analyticsRepository.getDashboardStats(userId, role);
  }
}



