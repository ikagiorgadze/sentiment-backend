import { PageRepository } from '../repositories/page.repository';
import { PageWithStats } from '../interfaces/models';
import { PageQueryOptions } from '../interfaces/query-options';

export class PageService {
  private pageRepository: PageRepository;

  constructor() {
    this.pageRepository = new PageRepository();
  }

  async getAllPagesWithAccess(userId: string, role: string, options: PageQueryOptions): Promise<PageWithStats[]> {
    return this.pageRepository.findAllWithAccess(userId, role, options);
  }
}
