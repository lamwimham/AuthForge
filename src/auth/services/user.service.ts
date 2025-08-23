import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../database/entities/user.entity';
import { PasswordService } from './password.service';

export interface CreateUserDto {
  email?: string;
  phone?: string;
  username?: string;
  password: string;
}

export interface CreateOAuthUserDto {
  email?: string;
  phone?: string;
  username?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  status?: UserStatus;
}

export interface UpdateUserDto {
  email?: string;
  phone?: string;
  username?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  mfaEnabled?: boolean;
  mfaSecret?: string;
  status?: UserStatus;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private passwordService: PasswordService,
  ) {}

  /**
   * 创建新用户
   */
  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const { email, phone, username, password } = createUserDto;

    // 检查唯一性约束
    await this.checkUniqueConstraints(email, phone, username);

    // 验证密码强度
    const passwordValidation = this.passwordService.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new Error(`密码强度不足: ${passwordValidation.errors.join(', ')}`);
    }

    // 哈希密码
    const passwordHash = await this.passwordService.hashPassword(password);

    // 创建用户
    const user = this.userRepository.create({
      email,
      phone,
      username,
      passwordHash,
      status: UserStatus.PENDING, // 初始状态为待验证
      emailVerified: false,
      phoneVerified: false,
      mfaEnabled: false,
      failedLoginAttempts: 0,
    });

    return this.userRepository.save(user);
  }

  /**
   * 创建OAuth用户（无需密码）
   */
  async createOAuthUser(createOAuthUserDto: CreateOAuthUserDto): Promise<User> {
    const { email, phone, username, emailVerified = false, phoneVerified = false, status = UserStatus.ACTIVE } = createOAuthUserDto;

    // 检查唯一性约束
    await this.checkUniqueConstraints(email, phone, username);

    // 创建用户
    const user = this.userRepository.create({
      email,
      phone,
      username,
      passwordHash: '', // OAuth用户初始无密码
      status,
      emailVerified,
      phoneVerified,
      mfaEnabled: false,
      failedLoginAttempts: 0,
    });

    return this.userRepository.save(user);
  }

  /**
   * 根据ID查找用户
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  /**
   * 根据手机号查找用户
   */
  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { phone },
    });
  }

  /**
   * 根据用户名查找用户
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },
    });
  }

  /**
   * 根据标识符查找用户（邮箱、手机号或用户名）
   */
  async findByIdentifier(identifier: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :identifier', { identifier })
      .orWhere('user.phone = :identifier', { identifier })
      .orWhere('user.username = :identifier', { identifier })
      .getOne();
  }

  /**
   * 根据ID查找用户（包含密码哈希）
   */
  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      select: ['id', 'email', 'phone', 'username', 'passwordHash', 'status', 
               'emailVerified', 'phoneVerified', 'mfaEnabled', 'mfaSecret',
               'failedLoginAttempts', 'lockedUntil', 'lastLoginAt'],
    });
  }

  /**
   * 根据标识符查找用户（包含密码哈希）
   */
  async findByIdentifierWithPassword(identifier: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :identifier', { identifier })
      .orWhere('user.phone = :identifier', { identifier })
      .orWhere('user.username = :identifier', { identifier })
      .getOne();
  }

  /**
   * 验证用户密码
   */
  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) {
      return false;
    }
    return this.passwordService.verifyPassword(password, user.passwordHash);
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 如果更新邮箱、手机号或用户名，检查唯一性
    const { email, phone, username } = updateUserDto;
    if (email && email !== user.email) {
      await this.checkEmailUnique(email);
    }
    if (phone && phone !== user.phone) {
      await this.checkPhoneUnique(phone);
    }
    if (username && username !== user.username) {
      await this.checkUsernameUnique(username);
    }

    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  /**
   * 更新密码
   */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证密码强度
    const passwordValidation = this.passwordService.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`密码强度不足: ${passwordValidation.errors.join(', ')}`);
    }

    const passwordHash = await this.passwordService.hashPassword(newPassword);
    await this.userRepository.update(id, { passwordHash });
  }

  /**
   * 激活用户账户
   */
  async activateUser(id: string): Promise<void> {
    await this.userRepository.update(id, { 
      status: UserStatus.ACTIVE 
    });
  }

  /**
   * 锁定用户账户
   */
  async lockUser(id: string, reason?: string): Promise<void> {
    await this.userRepository.update(id, { 
      status: UserStatus.LOCKED,
      lockedUntil: undefined, // 永久锁定
    });
  }

  /**
   * 禁用用户账户
   */
  async disableUser(id: string): Promise<void> {
    await this.userRepository.update(id, { 
      status: UserStatus.DISABLED 
    });
  }

  /**
   * 记录登录失败
   */
  async recordLoginFailure(user: User): Promise<void> {
    user.incrementFailedAttempts();
    await this.userRepository.save(user);
  }

  /**
   * 记录登录成功
   */
  async recordLoginSuccess(user: User): Promise<void> {
    user.resetFailedAttempts();
    await this.userRepository.save(user);
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(id: string): Promise<void> {
    await this.userRepository.update(id, { 
      emailVerified: true 
    });
  }

  /**
   * 验证手机号
   */
  async verifyPhone(id: string): Promise<void> {
    await this.userRepository.update(id, { 
      phoneVerified: true 
    });
  }

  /**
   * 启用MFA
   */
  async enableMFA(id: string, mfaSecret: string): Promise<void> {
    await this.userRepository.update(id, {
      mfaEnabled: true,
      mfaSecret,
    });
  }

  /**
   * 禁用MFA
   */
  async disableMFA(id: string): Promise<void> {
    await this.userRepository.update(id, {
      mfaEnabled: false,
      mfaSecret: undefined,
    });
  }

  /**
   * 软删除用户
   */
  async softDeleteUser(id: string): Promise<void> {
    await this.userRepository.update(id, { 
      status: UserStatus.DISABLED,
      email: undefined,
      phone: undefined,
      username: undefined,
    });
  }

  /**
   * 检查唯一性约束
   */
  private async checkUniqueConstraints(
    email?: string,
    phone?: string,
    username?: string,
  ): Promise<void> {
    if (email) {
      await this.checkEmailUnique(email);
    }
    if (phone) {
      await this.checkPhoneUnique(phone);
    }
    if (username) {
      await this.checkUsernameUnique(username);
    }
  }

  /**
   * 检查邮箱唯一性
   */
  private async checkEmailUnique(email: string): Promise<void> {
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('邮箱已被使用');
    }
  }

  /**
   * 检查手机号唯一性
   */
  private async checkPhoneUnique(phone: string): Promise<void> {
    const existingUser = await this.findByPhone(phone);
    if (existingUser) {
      throw new ConflictException('手机号已被使用');
    }
  }

  /**
   * 检查用户名唯一性
   */
  private async checkUsernameUnique(username: string): Promise<void> {
    const existingUser = await this.findByUsername(username);
    if (existingUser) {
      throw new ConflictException('用户名已被使用');
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    locked: number;
    disabled: number;
    pending: number;
  }> {
    const [total, active, locked, disabled, pending] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { status: UserStatus.ACTIVE } }),
      this.userRepository.count({ where: { status: UserStatus.LOCKED } }),
      this.userRepository.count({ where: { status: UserStatus.DISABLED } }),
      this.userRepository.count({ where: { status: UserStatus.PENDING } }),
    ]);

    return { total, active, locked, disabled, pending };
  }
}