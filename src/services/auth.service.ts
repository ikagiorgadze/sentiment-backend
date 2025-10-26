import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from '../repositories/auth.repository';
import { 
  RegisterRequest, 
  LoginRequest, 
  AuthResponse, 
  AuthUserResponse,
  JWTPayload 
} from '../interfaces/auth';
import { authConfig } from '../config/auth';

export class AuthService {
  private authRepository: AuthRepository;

  constructor() {
    this.authRepository = new AuthRepository();
  }

  private toUserResponse(user: any): AuthUserResponse {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: user.last_login,
    };
  }

  private generateToken(payload: JWTPayload): string {
    return jwt.sign(
      payload as object,
      authConfig.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      console.log('[AuthService] Starting registration validation');
      
      // Validate input
      if (!data.username || !data.email || !data.password) {
        throw new Error('Username, email, and password are required');
      }

      if (data.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new Error('Invalid email format');
      }

      console.log('[AuthService] Checking for existing user');
      
      // Check if user already exists
      const existingUserByEmail = await this.authRepository.findByEmail(data.email);
      if (existingUserByEmail) {
        throw new Error('Email already registered');
      }

      const existingUserByUsername = await this.authRepository.findByUsername(data.username);
      if (existingUserByUsername) {
        throw new Error('Username already taken');
      }

      console.log('[AuthService] Hashing password');
      
      // Hash password
      const passwordHash = await bcrypt.hash(data.password, authConfig.bcryptRounds);

      console.log('[AuthService] Creating user in database');
      
      // Create user with default 'user' role
      const user = await this.authRepository.createUser(
        data.username,
        data.email,
        passwordHash,
        'user'
      );

      console.log('[AuthService] User created:', { id: user.id, role: user.role });

      // Ensure role exists (defensive check)
      if (!user.role) {
        user.role = 'user';
      }

      console.log('[AuthService] Generating JWT token');
      
      // Generate token
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      });

      console.log('[AuthService] Creating session');
      
      // Create session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
      await this.authRepository.createSession(user.id, token, expiresAt);

      console.log('[AuthService] Updating last login');
      
      // Update last login
      await this.authRepository.updateLastLogin(user.id);

      console.log('[AuthService] Registration complete');

      return {
        user: this.toUserResponse(user),
        token,
      };
    } catch (error) {
      console.error('[AuthService] Registration error:', error);
      throw error;
    }
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    // Validate input
    if (!data.email || !data.password) {
      throw new Error('Email and password are required');
    }

    // Find user
    const user = await this.authRepository.findByEmail(data.email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    await this.authRepository.createSession(user.id, token, expiresAt);

    // Update last login
    await this.authRepository.updateLastLogin(user.id);

    return {
      user: this.toUserResponse(user),
      token,
    };
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, authConfig.jwtSecret) as JWTPayload;
      
      // Check if session exists and is valid
      const session = await this.authRepository.findSessionByToken(token);
      if (!session) {
        throw new Error('Invalid or expired session');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async getCurrentUser(token: string): Promise<AuthUserResponse> {
    const payload = await this.verifyToken(token);
    const user = await this.authRepository.findById(payload.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return this.toUserResponse(user);
  }

  async logout(token: string): Promise<void> {
    await this.authRepository.deleteSession(token);
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.authRepository.deleteExpiredSessions();
  }
}



