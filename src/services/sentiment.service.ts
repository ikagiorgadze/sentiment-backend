import { SentimentRepository } from '../repositories/sentiment.repository';
import { SentimentWithDetails } from '../interfaces/models';
import { SentimentQueryOptions } from '../interfaces/query-options';

export class SentimentService {
  private sentimentRepository: SentimentRepository;

  constructor() {
    this.sentimentRepository = new SentimentRepository();
  }

  // Get all sentiments with access control
  async getAllSentimentsWithAccess(
    userId: string,
    role: string,
    options: SentimentQueryOptions
  ): Promise<SentimentWithDetails[]> {
    return this.sentimentRepository.findAllWithAccess(userId, role, options);
  }

  // Get sentiment by ID with access control
  async getSentimentByIdWithAccess(
    id: string,
    userId: string,
    role: string,
    options: SentimentQueryOptions
  ): Promise<SentimentWithDetails | null> {
    return this.sentimentRepository.findByIdWithAccess(id, userId, role, options);
  }

  // Legacy methods without access control (for backward compatibility or internal use)
  async getAllSentiments(options: SentimentQueryOptions): Promise<SentimentWithDetails[]> {
    return this.sentimentRepository.findAll(options);
  }

  async getSentimentById(id: string, options: SentimentQueryOptions): Promise<SentimentWithDetails | null> {
    return this.sentimentRepository.findById(id, options);
  }
}



