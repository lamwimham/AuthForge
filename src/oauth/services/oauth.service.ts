import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../../database/entities/user.entity';
import { OAuthClient, ClientType } from '../../database/entities/oauth-client.entity';
import { OAuthAuthorizationCode } from '../../database/entities/oauth-authorization-code.entity';
import { OAuthAccessToken } from '../../database/entities/oauth-access-token.entity';
import { SSOSession } from '../../database/entities/sso-session.entity';
import { UserConsent } from '../../database/entities/user-consent.entity';
import { JwksService } from './jwks.service';
import { JwtService } from '@nestjs/jwt';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { Redis } from 'ioredis';

/**
 * 授权请求 DTO
 */
export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  nonce?: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 令牌请求 DTO
 */
export interface TokenRequest {
  grantType: string;
  code?: string;
  redirectUri?: string;
  clientId: string;
  clientSecret?: string;
  codeVerifier?: string;
  refreshToken?: string;
}

/**
 * 令牌响应
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

/**
 * 授权码验证结果
 */
export interface AuthorizationCodeValidation {
  code: OAuthAuthorizationCode;
  client: OAuthClient;
  user: User;
}

/**
 * OAuth 2.0 核心服务
 * 实现 Authorization Code Flow + PKCE
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly authorizationCodeTtl = 600; // 10 分钟
  private readonly ssoSessionTtlDays = 7; // SSO 会话 7 天

  constructor(
    @InjectRepository(OAuthClient)
    private clientRepository: Repository<OAuthClient>,
    @InjectRepository(OAuthAuthorizationCode)
    private authCodeRepository: Repository<OAuthAuthorizationCode>,
    @InjectRepository(OAuthAccessToken)
    private accessTokenRepository: Repository<OAuthAccessToken>,
    @InjectRepository(SSOSession)
    private ssoSessionRepository: Repository<SSOSession>,
    @InjectRepository(UserConsent)
    private consentRepository: Repository<UserConsent>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwksService: JwksService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private redis: Redis,
  ) {}

  /**
   * 验证客户端
   */
  async validateClient(
    clientId: string,
    clientSecret?: string,
  ): Promise<OAuthClient> {
    const client = await this.clientRepository.findOne({
      where: { clientId, isActive: true },
    });

    if (!client) {
      throw new UnauthorizedException('Invalid client');
    }

    // 机密客户端需要验证密钥
    if (client.isConfidential()) {
      if (!clientSecret) {
        throw new UnauthorizedException('Client secret is required');
      }

      const secretHash = crypto
        .createHash('sha256')
        .update(clientSecret)
        .digest('hex');

      if (secretHash !== client.clientSecretHash) {
        throw new UnauthorizedException('Invalid client secret');
      }
    }

    // 公开客户端必须启用 PKCE
    if (!client.isConfidential() && !client.requirePkce) {
      this.logger.warn(
        `Public client ${clientId} does not require PKCE, this is not recommended`,
      );
    }

    return client;
  }

  /**
   * 验证授权请求参数
   */
  async validateAuthorizationRequest(
    clientId: string,
    redirectUri: string,
    responseType: string,
    scope: string,
    codeChallenge?: string,
  ): Promise<OAuthClient> {
    // 验证客户端
    const client = await this.clientRepository.findOne({
      where: { clientId, isActive: true },
    });

    if (!client) {
      throw new BadRequestException('Invalid client_id');
    }

    // 验证 response_type
    if (responseType !== 'code') {
      throw new BadRequestException(
        'Unsupported response_type. Only "code" is supported.',
      );
    }

    // 验证 redirect_uri
    if (!client.isValidRedirectUri(redirectUri)) {
      throw new BadRequestException('Invalid redirect_uri');
    }

    // 验证 scope
    const scopes = scope.split(' ').filter(Boolean);
    if (!client.isScopeAllowed(scopes)) {
      throw new BadRequestException('Invalid or unauthorized scope');
    }

    // 公开客户端必须提供 PKCE
    if (!client.isConfidential() && !codeChallenge) {
      throw new BadRequestException(
        'PKCE is required for public clients. Please provide code_challenge.',
      );
    }

    return client;
  }

  /**
   * 检查用户是否已授权该客户端
   */
  async checkUserConsent(
    userId: string,
    clientId: string,
    requestedScopes: string[],
  ): Promise<{ hasConsent: boolean; consent?: UserConsent }> {
    const consent = await this.consentRepository.findOne({
      where: { userId, clientId, isRevoked: false },
    });

    if (!consent) {
      return { hasConsent: false };
    }

    // 检查请求的范围是否都已授权
    const hasAllScopes = requestedScopes.every((scope) =>
      consent.scopes.includes(scope),
    );

    return { hasConsent: hasAllScopes, consent };
  }

  /**
   * 保存用户授权确认
   */
  async saveUserConsent(
    userId: string,
    clientId: string,
    scopes: string[],
  ): Promise<UserConsent> {
    let consent = await this.consentRepository.findOne({
      where: { userId, clientId },
    });

    if (consent) {
      consent.updateScopes(scopes);
      consent.isRevoked = false;
    } else {
      consent = this.consentRepository.create({
        userId,
        clientId,
        scopes,
        lastGrantedAt: new Date(),
      });
    }

    return this.consentRepository.save(consent);
  }

  /**
   * 创建授权码
   */
  async createAuthorizationCode(
    request: AuthorizationRequest,
  ): Promise<string> {
    // 生成授权码
    const code = this.generateSecureToken();
    const codeHash = this.hashToken(code);

    // 解析 scope
    const scopes = request.scope.split(' ').filter(Boolean);

    // 计算过期时间
    const expiresAt = new Date(Date.now() + this.authorizationCodeTtl * 1000);

    // 获取客户端 ID
    const client = await this.clientRepository.findOne({
      where: { clientId: request.clientId },
    });

    if (!client) {
      throw new BadRequestException('Invalid client');
    }

    // 创建授权码记录
    const authCode = this.authCodeRepository.create({
      codeHash,
      clientId: client.id,
      userId: request.userId,
      redirectUri: request.redirectUri,
      scope: scopes,
      codeChallenge: request.codeChallenge,
      codeChallengeMethod: request.codeChallengeMethod || 'S256',
      state: request.state,
      nonce: request.nonce,
      expiresAt,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });

    await this.authCodeRepository.save(authCode);

    this.logger.debug(
      `Created authorization code for user ${request.userId} and client ${request.clientId}`,
    );

    return code;
  }

  /**
   * 验证授权码
   */
  async validateAuthorizationCode(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier?: string,
  ): Promise<AuthorizationCodeValidation> {
    const codeHash = this.hashToken(code);

    const authCode = await this.authCodeRepository.findOne({
      where: { codeHash },
      relations: ['client', 'user'],
    });

    if (!authCode) {
      throw new UnauthorizedException('Invalid authorization code');
    }

    // 检查客户端匹配
    const client = await this.clientRepository.findOne({
      where: { clientId },
    });

    if (!client || authCode.clientId !== client.id) {
      throw new UnauthorizedException('Authorization code does not belong to this client');
    }

    // 检查授权码有效性
    if (!authCode.isValid()) {
      throw new UnauthorizedException(
        authCode.isUsed()
          ? 'Authorization code has already been used'
          : 'Authorization code has expired',
      );
    }

    // 验证 redirect_uri 匹配
    if (authCode.redirectUri !== redirectUri) {
      throw new UnauthorizedException('redirect_uri mismatch');
    }

    // 验证 PKCE
    if (authCode.codeChallenge && !codeVerifier) {
      throw new UnauthorizedException('code_verifier is required');
    }

    if (authCode.codeChallenge && codeVerifier) {
      if (!authCode.verifyCodeVerifier(codeVerifier)) {
        throw new UnauthorizedException('Invalid code_verifier');
      }
    }

    return { code: authCode, client, user: authCode.user };
  }

  /**
   * 交换令牌
   */
  async exchangeToken(request: TokenRequest): Promise<TokenResponse> {
    if (request.grantType !== 'authorization_code') {
      throw new BadRequestException(
        'Unsupported grant_type. Only "authorization_code" is supported.',
      );
    }

    if (!request.code) {
      throw new BadRequestException('Missing required parameter: code');
    }

    if (!request.redirectUri) {
      throw new BadRequestException('Missing required parameter: redirect_uri');
    }

    // 验证客户端
    const client = await this.validateClient(
      request.clientId,
      request.clientSecret,
    );

    // 验证授权码
    const { code: authCode, user } = await this.validateAuthorizationCode(
      request.code,
      request.clientId,
      request.redirectUri,
      request.codeVerifier,
    );

    // 标记授权码为已使用
    authCode.markAsUsed();
    await this.authCodeRepository.save(authCode);

    // 生成令牌
    return this.generateTokens(client, user, authCode.scope, authCode.nonce);
  }

  /**
   * 生成令牌
   */
  async generateTokens(
    client: OAuthClient,
    user: User,
    scopes: string[],
    nonce?: string,
  ): Promise<TokenResponse> {
    // 获取 RSA 私钥
    const { privateKey, keyId } = await this.jwksService.getActivePrivateKey();

    // 生成 Access Token
    const accessToken = await this.generateAccessToken(
      client,
      user,
      scopes,
      privateKey,
      keyId,
    );

    // 生成 Refresh Token
    const refreshToken = this.generateSecureToken();

    // 生成 ID Token (OIDC)
    let idToken: string | undefined;
    if (scopes.includes('openid')) {
      idToken = await this.generateIdToken(
        client,
        user,
        scopes,
        privateKey,
        keyId,
        nonce,
      );
    }

    // 存储 Access Token
    const accessTokenEntity = this.accessTokenRepository.create({
      tokenHash: this.hashToken(accessToken),
      clientId: client.id,
      userId: user.id,
      scope: scopes,
      expiresAt: new Date(Date.now() + client.accessTokenTtl * 1000),
      jti: crypto.randomBytes(16).toString('hex'),
    });

    await this.accessTokenRepository.save(accessTokenEntity);

    // 存储 Refresh Token（使用 Redis）
    const refreshTokenKey = `refresh_token:${this.hashToken(refreshToken)}`;
    await this.redis.set(
      refreshTokenKey,
      JSON.stringify({
        userId: user.id,
        clientId: client.id,
        scopes,
      }),
      'EX',
      client.refreshTokenTtl,
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: client.accessTokenTtl,
      refresh_token: refreshToken,
      id_token: idToken,
      scope: scopes.join(' '),
    };
  }

  /**
   * 生成 Access Token (JWT)
   */
  private async generateAccessToken(
    client: OAuthClient,
    user: User,
    scopes: string[],
    privateKey: string,
    keyId: string,
  ): Promise<string> {
    const payload = {
      sub: user.id,
      client_id: client.clientId,
      scope: scopes.join(' '),
      aud: client.clientId,
      iss: this.configService.get('APP_URL', 'http://localhost:3000'),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + client.accessTokenTtl,
      jti: crypto.randomBytes(16).toString('hex'),
    };

    return this.jwtService.sign(payload, {
      algorithm: 'RS256',
      keyid: keyId,
      secret: privateKey,
      privateKey: privateKey,
    } as any);
  }

  /**
   * 生成 ID Token (OIDC)
   */
  private async generateIdToken(
    client: OAuthClient,
    user: User,
    scopes: string[],
    privateKey: string,
    keyId: string,
    nonce?: string,
  ): Promise<string> {
    const payload: Record<string, any> = {
      sub: user.id,
      aud: client.clientId,
      iss: this.configService.get('APP_URL', 'http://localhost:3000'),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + client.accessTokenTtl,
      auth_time: Math.floor(Date.now() / 1000),
    };

    // 添加 nonce
    if (nonce) {
      payload.nonce = nonce;
    }

    // 添加 profile 信息
    if (scopes.includes('profile')) {
      payload.name = user.getFullName();
      payload.given_name = user.firstName;
      payload.family_name = user.lastName;
      payload.picture = user.avatar;
      if (user.username) {
        payload.preferred_username = user.username;
      }
    }

    // 添加 email 信息
    if (scopes.includes('email')) {
      payload.email = user.email;
      payload.email_verified = user.emailVerified;
    }

    return this.jwtService.sign(payload, {
      algorithm: 'RS256',
      keyid: keyId,
      secret: privateKey,
      privateKey: privateKey,
    } as any);
  }

  /**
   * 验证 Access Token
   */
  async validateAccessToken(token: string): Promise<{
    valid: boolean;
    payload?: any;
    user?: User;
    client?: OAuthClient;
  }> {
    try {
      // 解码 token 获取 kid
      const decoded = this.jwtService.decode(token, { complete: true }) as any;
      if (!decoded || !decoded.header.kid) {
        return { valid: false };
      }

      // 获取公钥
      const publicKey = await this.jwksService.getPublicKey(decoded.header.kid);
      if (!publicKey) {
        return { valid: false };
      }

      // 验证签名
      const payload = this.jwtService.verify(token, {
        algorithms: ['RS256'],
        publicKey: publicKey,
        secret: publicKey,
      } as any);

      // 检查数据库中是否已撤销
      const tokenHash = this.hashToken(token);
      const storedToken = await this.accessTokenRepository.findOne({
        where: { tokenHash },
        relations: ['user', 'client'],
      });

      if (!storedToken || !storedToken.isValid()) {
        return { valid: false };
      }

      return {
        valid: true,
        payload,
        user: storedToken.user,
        client: storedToken.client,
      };
    } catch (error) {
      this.logger.debug(`Token validation failed: ${error.message}`);
      return { valid: false };
    }
  }

  /**
   * 撤销令牌
   */
  async revokeToken(token: string, tokenTypeHint?: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);

    if (tokenTypeHint === 'refresh_token' || !tokenTypeHint) {
      // 尝试删除 refresh token
      const result = await this.redis.del(`refresh_token:${tokenHash}`);
      if (result > 0) return true;
    }

    if (tokenTypeHint === 'access_token' || !tokenTypeHint) {
      // 撤销 access token
      const result = await this.accessTokenRepository.update(
        { tokenHash },
        { revokedAt: new Date(), revokeReason: 'User requested revocation' },
      );
      if (result.affected && result.affected > 0) return true;
    }

    return false;
  }

  // ============ SSO 会话管理 ============

  /**
   * 创建或获取 SSO 会话
   */
  async getOrCreateSSOSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    // 查找有效的现有会话
    const existingSession = await this.ssoSessionRepository.findOne({
      where: {
        userId,
        isLoggedOut: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (existingSession && !existingSession.isExpired()) {
      existingSession.updateActivity();
      await this.ssoSessionRepository.save(existingSession);
      return existingSession.sessionHash;
    }

    // 创建新会话
    const sessionToken = this.generateSecureToken();
    const sessionHash = this.hashToken(sessionToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.ssoSessionTtlDays);

    const session = this.ssoSessionRepository.create({
      sessionHash,
      userId,
      expiresAt,
      lastActivityAt: new Date(),
      ipAddress,
      userAgent,
      authorizedClients: [],
    });

    await this.ssoSessionRepository.save(session);

    return sessionToken;
  }

  /**
   * 验证 SSO 会话
   */
  async validateSSOSession(sessionToken: string): Promise<SSOSession | null> {
    const sessionHash = this.hashToken(sessionToken);

    const session = await this.ssoSessionRepository.findOne({
      where: { sessionHash },
      relations: ['user'],
    });

    if (!session || !session.isValid()) {
      return null;
    }

    // 更新活动时间
    session.updateActivity();
    await this.ssoSessionRepository.save(session);

    return session;
  }

  /**
   * 登出 SSO 会话
   */
  async logoutSSOSession(sessionToken: string): Promise<void> {
    const sessionHash = this.hashToken(sessionToken);

    await this.ssoSessionRepository.update(
      { sessionHash },
      { isLoggedOut: true },
    );
  }

  /**
   * 登出用户所有 SSO 会话
   */
  async logoutAllSessions(userId: string): Promise<void> {
    await this.ssoSessionRepository.update(
      { userId },
      { isLoggedOut: true },
    );

    // 撤销所有 access tokens
    await this.accessTokenRepository.update(
      { userId },
      { revokedAt: new Date(), revokeReason: 'User logged out all sessions' },
    );
  }

  // ============ 工具方法 ============

  /**
   * 生成安全随机令牌
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * 哈希令牌
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}