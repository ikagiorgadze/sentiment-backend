import { PostRepository } from '../repositories/post.repository';
import { PostWithDetails } from '../interfaces/models';
import { PostQueryOptions } from '../interfaces/query-options';

export class PostService {
  private postRepository: PostRepository;

  constructor() {
    this.postRepository = new PostRepository();
  }

  // Get all posts with access control
  async getAllPostsWithAccess(
    userId: string,
    role: string,
    options: PostQueryOptions
  ): Promise<PostWithDetails[]> {
    return this.postRepository.findAllWithAccess(userId, role, options);
  }

  // Get post by ID with access control
  async getPostByIdWithAccess(
    id: string,
    userId: string,
    role: string,
    options: PostQueryOptions
  ): Promise<PostWithDetails | null> {
    return this.postRepository.findByIdWithAccess(id, userId, role, options);
  }

  // Legacy methods without access control (for backward compatibility or internal use)
  async getAllPosts(options: PostQueryOptions): Promise<PostWithDetails[]> {
    return this.postRepository.findAll(options);
  }

  async getPostById(id: string, options: PostQueryOptions): Promise<PostWithDetails | null> {
    return this.postRepository.findById(id, options);
  }
}



