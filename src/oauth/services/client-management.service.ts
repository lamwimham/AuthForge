import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { OAuthClient, ClientType } from '../../database/entities/oauth-client.entity';
import { User } from '../../database/entities/user.entity';

/**
 * 创建客户端 DTO
 */
export interface CreateClientDto {
  name: string;
  description?: string;
  logoUrl?: string;
  homepageUrl?: string;
  redirectUris: string[];
  postLogoutRedirectUris?: string[];
  allowedScopes: string[];
  clientType: ClientType;
  requirePkce?: boolean;
  skipConsent?: boolean;
  accessTokenTtl?: number;
  refreshTokenTtl?: number;
}

/**
 * 更新客户端 DTO
 */
export interface UpdateClientDto {
  name?: string;
  description?: string;
  logoUrl?: string;
  homepageUrl?: string;
  redirectUris?: string[];
  postLogoutRedirectUris?: string[];
  allowedScopes?: string[];
  requirePkce?: boolean;
  skipConsent?: boolean;
  accessTokenTtl?: number;
  refreshTokenTtl?: number;
  isActive?: boolean;
}

/**
 * 客户端响应
 */
export interface ClientResponse {
  id: string;
  clientId: string;
  clientSecret?: string; // 仅创建时返回
  name: string;
  description?: string;
  logoUrl?: string;
  homepageUrl?: string;
  redirectUris: string[];
  postLogoutRedirectUris?: string[];
  allowedScopes: string[];
  clientType: ClientType;
  requirePkce: boolean;
  skipConsent: boolean;
  isActive: boolean;
  accessTokenTtl: number;
  refreshTokenTtl: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OAuth 客户端管理服务
 */
@Injectable()
export class ClientManagementService {
  private readonly logger = new Logger(ClientManagementService.name);

  constructor(
    @InjectRepository(OAuthClient)
    private clientRepository: Repository<OAuthClient>,
  ) {}

  /**
   * 创建新客户端
   */
  async createClient(
    userId: string,
    dto: CreateClientDto,
  ): Promise<ClientResponse> {
    // 生成客户端 ID 和密钥
    const clientId = this.generateClientId();
    const clientSecret = this.generateClientSecret();
    const clientSecretHash = this.hashSecret(clientSecret);

    // 公开客户端必须启用 PKCE
    const requirePkce =
      dto.clientType === ClientType.PUBLIC ? true : dto.requirePkce ?? false;

    const client = this.clientRepository.create({
      clientId,
      clientSecretHash,
      name: dto.name,
      description: dto.description,
      logoUrl: dto.logoUrl,
      homepageUrl: dto.homepageUrl,
      redirectUris: dto.redirectUris,
      postLogoutRedirectUris: dto.postLogoutRedirectUris,
      allowedScopes: dto.allowedScopes,
      clientType: dto.clientType,
      requirePkce,
      skipConsent: dto.skipConsent ?? false,
      accessTokenTtl: dto.accessTokenTtl ?? 3600,
      refreshTokenTtl: dto.refreshTokenTtl ?? 2592000,
      userId,
    });

    await this.clientRepository.save(client);

    this.logger.log(`Created OAuth client: ${clientId} for user: ${userId}`);

    const response = this.toResponse(client);
    // 仅创建时返回密钥
    response.clientSecret = clientSecret;

    return response;
  }

  /**
   * 更新客户端
   */
  async updateClient(
    clientId: string,
    userId: string,
    dto: UpdateClientDto,
  ): Promise<ClientResponse> {
    const client = await this.findClientById(clientId);

    // 检查权限
    if (client.userId && client.userId !== userId) {
      throw new ForbiddenException('You do not have permission to update this client');
    }

    // 更新字段
    if (dto.name !== undefined) client.name = dto.name;
    if (dto.description !== undefined) client.description = dto.description;
    if (dto.logoUrl !== undefined) client.logoUrl = dto.logoUrl;
    if (dto.homepageUrl !== undefined) client.homepageUrl = dto.homepageUrl;
    if (dto.redirectUris !== undefined) client.redirectUris = dto.redirectUris;
    if (dto.postLogoutRedirectUris !== undefined) {
      client.postLogoutRedirectUris = dto.postLogoutRedirectUris;
    }
    if (dto.allowedScopes !== undefined) client.allowedScopes = dto.allowedScopes;
    if (dto.requirePkce !== undefined) client.requirePkce = dto.requirePkce;
    if (dto.skipConsent !== undefined) client.skipConsent = dto.skipConsent;
    if (dto.accessTokenTtl !== undefined) client.accessTokenTtl = dto.accessTokenTtl;
    if (dto.refreshTokenTtl !== undefined) client.refreshTokenTtl = dto.refreshTokenTtl;
    if (dto.isActive !== undefined) client.isActive = dto.isActive;

    await this.clientRepository.save(client);

    this.logger.log(`Updated OAuth client: ${clientId}`);

    return this.toResponse(client);
  }

  /**
   * 重新生成客户端密钥
   */
  async regenerateSecret(
    clientId: string,
    userId: string,
  ): Promise<{ clientSecret: string }> {
    const client = await this.findClientById(clientId);

    // 检查权限
    if (client.userId && client.userId !== userId) {
      throw new ForbiddenException('You do not have permission to regenerate secret for this client');
    }

    // 只有机密客户端才有密钥
    if (!client.isConfidential()) {
      throw new BadRequestException('Public clients do not have a client secret');
    }

    const clientSecret = this.generateClientSecret();
    client.clientSecretHash = this.hashSecret(clientSecret);

    await this.clientRepository.save(client);

    this.logger.log(`Regenerated secret for OAuth client: ${clientId}`);

    return { clientSecret };
  }

  /**
   * 获取客户端详情
   */
  async getClient(clientId: string, userId: string): Promise<ClientResponse> {
    const client = await this.findClientById(clientId);

    // 检查权限
    if (client.userId && client.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this client');
    }

    return this.toResponse(client);
  }

  /**
   * 获取用户的所有客户端
   */
  async getUserClients(userId: string): Promise<ClientResponse[]> {
    const clients = await this.clientRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return clients.map((client) => this.toResponse(client));
  }

  /**
   * 删除客户端
   */
  async deleteClient(clientId: string, userId: string): Promise<void> {
    const client = await this.findClientById(clientId);

    // 检查权限
    if (client.userId && client.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this client');
    }

    await this.clientRepository.remove(client);

    this.logger.log(`Deleted OAuth client: ${clientId}`);
  }

  /**
   * 停用客户端
   */
  async deactivateClient(clientId: string, userId: string): Promise<void> {
    await this.updateClient(clientId, userId, { isActive: false });
  }

  /**
   * 激活客户端
   */
  async activateClient(clientId: string, userId: string): Promise<void> {
    await this.updateClient(clientId, userId, { isActive: true });
  }

  /**
   * 根据客户端 ID 查找
   */
  private async findClientById(clientId: string): Promise<OAuthClient> {
    const client = await this.clientRepository.findOne({
      where: { clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client not found: ${clientId}`);
    }

    return client;
  }

  /**
   * 生成客户端 ID
   */
  private generateClientId(): string {
    return 'client_' + crypto.randomBytes(16).toString('hex');
  }

  /**
   * 生成客户端密钥
   */
  private generateClientSecret(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * 哈希密钥
   */
  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  /**
   * 转换为响应格式
   */
  private toResponse(client: OAuthClient): ClientResponse {
    return {
      id: client.id,
      clientId: client.clientId,
      name: client.name,
      description: client.description,
      logoUrl: client.logoUrl,
      homepageUrl: client.homepageUrl,
      redirectUris: client.redirectUris,
      postLogoutRedirectUris: client.postLogoutRedirectUris,
      allowedScopes: client.allowedScopes,
      clientType: client.clientType,
      requirePkce: client.requirePkce,
      skipConsent: client.skipConsent,
      isActive: client.isActive,
      accessTokenTtl: client.accessTokenTtl,
      refreshTokenTtl: client.refreshTokenTtl,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }
}