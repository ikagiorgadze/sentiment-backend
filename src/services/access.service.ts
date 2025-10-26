import { AccessRepository } from '../repositories/access.repository';
import { PostRepository } from '../repositories/post.repository';
import { AuthRepository } from '../repositories/auth.repository';
import { UserPostAccess } from '../interfaces/auth';

export class AccessService {
  private accessRepository: AccessRepository;
  private postRepository: PostRepository;
  private authRepository: AuthRepository;

  constructor() {
    this.accessRepository = new AccessRepository();
    this.postRepository = new PostRepository();
    this.authRepository = new AuthRepository();
  }

  // Grant user access to a post
  async grantAccess(
    authUserId: string,
    postId: string,
    grantedBy: string
  ): Promise<UserPostAccess> {
    // Verify the user exists
    const user = await this.authRepository.findById(authUserId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify the post exists
    const post = await this.postRepository.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    return this.accessRepository.grantAccess(authUserId, postId, grantedBy);
  }

  // Revoke user access to a post
  async revokeAccess(authUserId: string, postId: string): Promise<void> {
    await this.accessRepository.revokeAccess(authUserId, postId);
  }

  // Check if user has access to a post
  async hasAccess(authUserId: string, postId: string): Promise<boolean> {
    return this.accessRepository.hasAccess(authUserId, postId);
  }

  // Get all posts a user has access to
  async getUserPosts(authUserId: string): Promise<string[]> {
    return this.accessRepository.getUserPosts(authUserId);
  }

  // Get all users who have access to a post
  async getPostUsers(postId: string): Promise<UserPostAccess[]> {
    return this.accessRepository.getPostUsers(postId);
  }

  // Grant bulk access (multiple users to one post)
  async grantBulkAccessToPost(
    userIds: string[],
    postId: string,
    grantedBy: string
  ): Promise<UserPostAccess[]> {
    const results: UserPostAccess[] = [];
    
    for (const userId of userIds) {
      const access = await this.grantAccess(userId, postId, grantedBy);
      results.push(access);
    }
    
    return results;
  }

  // Grant bulk access (one user to multiple posts)
  async grantBulkAccessToUser(
    authUserId: string,
    postIds: string[],
    grantedBy: string
  ): Promise<UserPostAccess[]> {
    const results: UserPostAccess[] = [];
    
    for (const postId of postIds) {
      const access = await this.grantAccess(authUserId, postId, grantedBy);
      results.push(access);
    }
    
    return results;
  }
}

