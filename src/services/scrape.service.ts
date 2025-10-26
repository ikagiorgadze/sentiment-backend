import axios from 'axios';
import { ScrapeRequest, ScrapeRequestWithAuth, N8nResponse } from '../interfaces/scrape';

export class ScrapeService {
  private readonly n8nWebhookUrl: string;
  
  // Regex patterns
  private readonly PAGE_URL_REGEX = /^(https?:\/\/)?(www\.)?facebook\.com\/[^\/]+\/?$/;
  private readonly POST_URL_REGEX = /^(https?:\/\/)?(www\.)?facebook\.com\/[^\/]+\/posts\/.+/;
  
  constructor() {
    this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://n8n:5678/webhook/ingest/scrape';
  }
  
  // Validate and return invalid URLs
  validatePageUrls(urls: string[]): string[] {
    return urls.filter(url => !this.PAGE_URL_REGEX.test(url));
  }
  
  validatePostUrls(urls: string[]): string[] {
    return urls.filter(url => !this.POST_URL_REGEX.test(url));
  }
  
  /**
   * Normalize a Facebook URL to ensure it has https:// prefix
   * @param url - The URL to normalize
   * @returns Normalized URL with https:// prefix
   */
  normalizeUrl(url: string): string {
    let normalized = url.trim();
    
    // Add https:// if no protocol specified
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized;
    }
    
    // Convert http:// to https:// for consistency
    normalized = normalized.replace(/^http:\/\//i, 'https://');
    
    return normalized;
  }
  
  async initiateScrape(request: ScrapeRequest, userId: string): Promise<N8nResponse> {
    // Add auth_user_id to request
    const requestWithAuth: ScrapeRequestWithAuth = {
      ...request,
      auth_user_id: userId,
    };
    
    // Forward to n8n
    const response = await axios.post(this.n8nWebhookUrl, requestWithAuth);
    return response.data;
  }

  async getUserJobs(_userId: string): Promise<any[]> {
    // For MVP, return mock data since we don't have a jobs table yet
    // In production, this would query a jobs table
    return [
      {
        id: 'job_1',
        status: 'completed',
        progress: 100,
        totalItems: 50,
        processedItems: 50,
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'job_2',
        status: 'running',
        progress: 65,
        totalItems: 30,
        processedItems: 20,
        startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: 'job_3',
        status: 'failed',
        progress: 0,
        totalItems: 25,
        processedItems: 0,
        startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        error: 'Network timeout',
      },
    ];
  }
}

