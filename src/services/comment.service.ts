import { CommentRepository } from '../repositories/comment.repository';
import { CommentWithDetails } from '../interfaces/models';
import { CommentQueryOptions } from '../interfaces/query-options';

export class CommentService {
  private commentRepository: CommentRepository;

  constructor() {
    this.commentRepository = new CommentRepository();
  }

  // Get all comments with access control
  async getAllCommentsWithAccess(
    userId: string,
    role: string,
    options: CommentQueryOptions
  ): Promise<CommentWithDetails[]> {
    return this.commentRepository.findAllWithAccess(userId, role, options);
  }

  // Get comment by ID with access control
  async getCommentByIdWithAccess(
    id: string,
    userId: string,
    role: string,
    options: CommentQueryOptions
  ): Promise<CommentWithDetails | null> {
    return this.commentRepository.findByIdWithAccess(id, userId, role, options);
  }

  // Legacy methods without access control (for backward compatibility or internal use)
  async getAllComments(options: CommentQueryOptions): Promise<CommentWithDetails[]> {
    return this.commentRepository.findAll(options);
  }

  async getCommentById(id: string, options: CommentQueryOptions): Promise<CommentWithDetails | null> {
    return this.commentRepository.findById(id, options);
  }
}



