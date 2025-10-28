import { UserRepository } from '../repositories/user.repository';
import { UserWithDetails } from '../interfaces/models';
import { UserQueryOptions } from '../interfaces/query-options';

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async getAllUsers(options: UserQueryOptions): Promise<{ users: UserWithDetails[]; totalCount: number }> {
    return this.userRepository.findAll(options);
  }

  async getUserById(id: string, options: UserQueryOptions): Promise<UserWithDetails | null> {
    return this.userRepository.findById(id, options);
  }
}
