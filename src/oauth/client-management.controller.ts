import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ClientManagementService,
  CreateClientDto,
  UpdateClientDto,
  ClientResponse,
} from './services/client-management.service';
import { ClientType } from '../database/entities/oauth-client.entity';

/**
 * OAuth 客户端管理控制器
 * 用于开发者创建和管理自己的应用
 */
@Controller('oauth/clients')
@UseGuards(JwtAuthGuard)
export class ClientManagementController {
  constructor(private clientManagementService: ClientManagementService) {}

  /**
   * 创建新的 OAuth 客户端应用
   * POST /oauth/clients
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createClient(
    @Request() req: any,
    @Body() body: {
      name: string;
      description?: string;
      logo_url?: string;
      homepage_url?: string;
      redirect_uris: string[];
      post_logout_redirect_uris?: string[];
      allowed_scopes: string[];
      client_type: ClientType;
      require_pkce?: boolean;
      skip_consent?: boolean;
      access_token_ttl?: number;
      refresh_token_ttl?: number;
    },
  ): Promise<ClientResponse> {
    const dto: CreateClientDto = {
      name: body.name,
      description: body.description,
      logoUrl: body.logo_url,
      homepageUrl: body.homepage_url,
      redirectUris: body.redirect_uris,
      postLogoutRedirectUris: body.post_logout_redirect_uris,
      allowedScopes: body.allowed_scopes,
      clientType: body.client_type,
      requirePkce: body.require_pkce,
      skipConsent: body.skip_consent,
      accessTokenTtl: body.access_token_ttl,
      refreshTokenTtl: body.refresh_token_ttl,
    };

    return this.clientManagementService.createClient(req.user.id, dto);
  }

  /**
   * 获取当前用户的所有客户端
   * GET /oauth/clients
   */
  @Get()
  async getClients(@Request() req: any): Promise<ClientResponse[]> {
    return this.clientManagementService.getUserClients(req.user.id);
  }

  /**
   * 获取客户端详情
   * GET /oauth/clients/:clientId
   */
  @Get(':clientId')
  async getClient(
    @Param('clientId') clientId: string,
    @Request() req: any,
  ): Promise<ClientResponse> {
    return this.clientManagementService.getClient(clientId, req.user.id);
  }

  /**
   * 更新客户端
   * PUT /oauth/clients/:clientId
   */
  @Put(':clientId')
  async updateClient(
    @Param('clientId') clientId: string,
    @Request() req: any,
    @Body() body: {
      name?: string;
      description?: string;
      logo_url?: string;
      homepage_url?: string;
      redirect_uris?: string[];
      post_logout_redirect_uris?: string[];
      allowed_scopes?: string[];
      require_pkce?: boolean;
      skip_consent?: boolean;
      access_token_ttl?: number;
      refresh_token_ttl?: number;
      is_active?: boolean;
    },
  ): Promise<ClientResponse> {
    const dto: UpdateClientDto = {
      name: body.name,
      description: body.description,
      logoUrl: body.logo_url,
      homepageUrl: body.homepage_url,
      redirectUris: body.redirect_uris,
      postLogoutRedirectUris: body.post_logout_redirect_uris,
      allowedScopes: body.allowed_scopes,
      requirePkce: body.require_pkce,
      skipConsent: body.skip_consent,
      accessTokenTtl: body.access_token_ttl,
      refreshTokenTtl: body.refresh_token_ttl,
      isActive: body.is_active,
    };

    return this.clientManagementService.updateClient(clientId, req.user.id, dto);
  }

  /**
   * 重新生成客户端密钥
   * POST /oauth/clients/:clientId/regenerate-secret
   */
  @Post(':clientId/regenerate-secret')
  @HttpCode(HttpStatus.OK)
  async regenerateSecret(
    @Param('clientId') clientId: string,
    @Request() req: any,
  ): Promise<{ client_secret: string }> {
    const result = await this.clientManagementService.regenerateSecret(
      clientId,
      req.user.id,
    );
    return { client_secret: result.clientSecret };
  }

  /**
   * 停用客户端
   * POST /oauth/clients/:clientId/deactivate
   */
  @Post(':clientId/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateClient(
    @Param('clientId') clientId: string,
    @Request() req: any,
  ): Promise<{ message: string }> {
    await this.clientManagementService.deactivateClient(clientId, req.user.id);
    return { message: 'Client deactivated successfully' };
  }

  /**
   * 激活客户端
   * POST /oauth/clients/:clientId/activate
   */
  @Post(':clientId/activate')
  @HttpCode(HttpStatus.OK)
  async activateClient(
    @Param('clientId') clientId: string,
    @Request() req: any,
  ): Promise<{ message: string }> {
    await this.clientManagementService.activateClient(clientId, req.user.id);
    return { message: 'Client activated successfully' };
  }

  /**
   * 删除客户端
   * DELETE /oauth/clients/:clientId
   */
  @Delete(':clientId')
  @HttpCode(HttpStatus.OK)
  async deleteClient(
    @Param('clientId') clientId: string,
    @Request() req: any,
  ): Promise<{ message: string }> {
    await this.clientManagementService.deleteClient(clientId, req.user.id);
    return { message: 'Client deleted successfully' };
  }
}