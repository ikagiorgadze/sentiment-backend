export interface ScrapeRequest {
  page_urls?: string[];
  post_urls?: string[];
  source: string;
}

export interface ScrapeRequestWithAuth extends ScrapeRequest {
  auth_user_id: string;
}

export interface N8nSuccessResponse {
  ok: true;
  accepted?: boolean;
  already_scraped?: boolean;
  mode?: 'page' | 'post';
  pages_count?: number;
  start_urls?: string[];
  page_url?: string;
  post_url?: string;
  request_id?: string;
  apify_run_id?: string;
  apify_dataset_id?: string;
  window?: {
    since: string;
    until: string;
  };
  last_window_until?: string;
  message?: string;
}

export interface N8nErrorResponse {
  ok: false;
  errors: string[];
}

export type N8nResponse = N8nSuccessResponse | N8nErrorResponse;

