import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OAuthService } from './services/oauth.service';
import type { TokenRequest } from './services/oauth.service';
import { JwksService } from './services/jwks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * OAuth 2.0 授权控制器
 */
@Controller('oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private oauthService: OAuthService,
    private jwksService: JwksService,
  ) {}

  /**
   * 授权端点 (Authorization Endpoint)
   * GET /oauth/authorize
   */
  @Get('authorize')
  @Public()
  async authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('response_type') responseType: string,
    @Query('scope') scope: string,
    @Query('state') state: string,
    @Query('code_challenge') codeChallenge: string,
    @Query('code_challenge_method') codeChallengeMethod: string,
    @Query('nonce') nonce: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // 验证请求参数
    const client = await this.oauthService.validateAuthorizationRequest(
      clientId,
      redirectUri,
      responseType,
      scope,
      codeChallenge,
    );

    // 检查用户是否已登录（通过 SSO 会话）
    const sessionToken = req.cookies?.['sso_session'];
    const session = sessionToken
      ? await this.oauthService.validateSSOSession(sessionToken)
      : null;

    if (!session) {
      // 用户未登录，重定向到登录页面
      const loginUrl = new URL('/login', req.baseUrl);
      loginUrl.searchParams.set('redirect', req.originalUrl);
      res.redirect(loginUrl.toString());
      return;
    }

    const userId = session.user.id;
    const scopes = scope.split(' ').filter(Boolean);

    // 检查是否需要用户授权确认
    const { hasConsent, consent } = await this.oauthService.checkUserConsent(
      userId,
      client.id,
      scopes,
    );

    if (hasConsent || client.skipConsent) {
      // 已授权或跳过确认，直接生成授权码
      const code = await this.oauthService.createAuthorizationCode({
        clientId,
        redirectUri,
        responseType,
        scope,
        state,
        codeChallenge,
        codeChallengeMethod,
        nonce,
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // 构建回调 URL
      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set('code', code);
      if (state) {
        callbackUrl.searchParams.set('state', state);
      }

      res.redirect(callbackUrl.toString());
      return;
    }

    // 需要用户授权确认，渲染授权页面
    const consentUrl = new URL('/oauth/consent', req.baseUrl);
    consentUrl.searchParams.set('client_id', clientId);
    consentUrl.searchParams.set('redirect_uri', redirectUri);
    consentUrl.searchParams.set('response_type', responseType);
    consentUrl.searchParams.set('scope', scope);
    if (state) consentUrl.searchParams.set('state', state);
    if (codeChallenge) consentUrl.searchParams.set('code_challenge', codeChallenge);
    if (codeChallengeMethod) consentUrl.searchParams.set('code_challenge_method', codeChallengeMethod);
    if (nonce) consentUrl.searchParams.set('nonce', nonce);

    res.redirect(consentUrl.toString());
  }

  /**
   * 授权确认页面
   * GET /oauth/consent
   */
  @Get('consent')
  @UseGuards(JwtAuthGuard)
  async getConsentPage(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('response_type') responseType: string,
    @Query('scope') scope: string,
    @Query('state') state: string,
    @Query('code_challenge') codeChallenge: string,
    @Query('code_challenge_method') codeChallengeMethod: string,
    @Query('nonce') nonce: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // 返回授权确认页面数据（前端渲染）
    res.json({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: responseType,
      scope: scope,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      nonce: nonce,
      scopes: scope.split(' ').filter(Boolean).map((s) => ({
        name: s,
        description: this.getScopeDescription(s),
      })),
    });
  }

  /**
   * 提交授权确认
   * POST /oauth/consent
   */
  @Post('consent')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async submitConsent(
    @Body()
    body: {
      client_id: string;
      redirect_uri: string;
      response_type: string;
      scope: string;
      state?: string;
      code_challenge?: string;
      code_challenge_method?: string;
      nonce?: string;
      allow: boolean;
    },
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const userId = (req.user as any).id;

    if (!body.allow) {
      // 用户拒绝授权
      const denyUrl = new URL(body.redirect_uri);
      denyUrl.searchParams.set('error', 'access_denied');
      denyUrl.searchParams.set('error_description', 'User denied access');
      if (body.state) {
        denyUrl.searchParams.set('state', body.state);
      }
      res.redirect(denyUrl.toString());
      return;
    }

    // 保存用户授权确认
    const scopes = body.scope.split(' ').filter(Boolean);
    const client = await this.oauthService.validateAuthorizationRequest(
      body.client_id,
      body.redirect_uri,
      body.response_type,
      body.scope,
      body.code_challenge,
    );

    await this.oauthService.saveUserConsent(userId, client.id, scopes);

    // 生成授权码
    const code = await this.oauthService.createAuthorizationCode({
      clientId: body.client_id,
      redirectUri: body.redirect_uri,
      responseType: body.response_type,
      scope: body.scope,
      state: body.state,
      codeChallenge: body.code_challenge,
      codeChallengeMethod: body.code_challenge_method,
      nonce: body.nonce,
      userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // 构建回调 URL
    const callbackUrl = new URL(body.redirect_uri);
    callbackUrl.searchParams.set('code', code);
    if (body.state) {
      callbackUrl.searchParams.set('state', body.state);
    }

    res.json({
      redirect_uri: callbackUrl.toString(),
    });
  }

  /**
   * 令牌端点 (Token Endpoint)
   * POST /oauth/token
   */
  @Post('token')
  @Public()
  @HttpCode(HttpStatus.OK)
  async token(@Body() body: TokenRequest): Promise<any> {
    const result = await this.oauthService.exchangeToken(body);
    return result;
  }

  /**
   * 令牌撤销端点
   * POST /oauth/revoke
   */
  @Post('revoke')
  @Public()
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Body() body: { token: string; token_type_hint?: string },
  ): Promise<{ success: boolean }> {
    const success = await this.oauthService.revokeToken(
      body.token,
      body.token_type_hint,
    );
    return { success };
  }

  /**
   * 令牌内省端点 (Token Introspection)
   * POST /oauth/introspect
   */
  @Post('introspect')
  @Public()
  @HttpCode(HttpStatus.OK)
  async introspect(
    @Body() body: { token: string; token_type_hint?: string },
  ): Promise<any> {
    const result = await this.oauthService.validateAccessToken(body.token);

    if (!result.valid) {
      return { active: false };
    }

    return {
      active: true,
      sub: result.payload.sub,
      client_id: result.payload.client_id,
      scope: result.payload.scope,
      aud: result.payload.aud,
      iss: result.payload.iss,
      exp: result.payload.exp,
      iat: result.payload.iat,
    };
  }

  // ============ OIDC 端点 ============

  /**
   * 用户信息端点
   * GET /oauth/userinfo
   */
  @Get('userinfo')
  @UseGuards(JwtAuthGuard)
  async userInfo(@Req() req: Request): Promise<any> {
    const user = req.user as any;
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || '';

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const result = await this.oauthService.validateAccessToken(token);
    if (!result.valid || !result.client) {
      throw new UnauthorizedException('Invalid token');
    }

    const scopes = result.payload.scope?.split(' ') || [];
    const userInfo: Record<string, any> = {
      sub: user.id,
    };

    // 根据 scope 返回用户信息
    if (scopes.includes('profile')) {
      userInfo.name = user.getFullName?.() || '';
      userInfo.given_name = user.firstName;
      userInfo.family_name = user.lastName;
      userInfo.picture = user.avatar;
      if (user.username) {
        userInfo.preferred_username = user.username;
      }
    }

    if (scopes.includes('email')) {
      userInfo.email = user.email;
      userInfo.email_verified = user.emailVerified;
    }

    if (scopes.includes('phone')) {
      userInfo.phone_number = user.phone;
      userInfo.phone_number_verified = user.phoneVerified;
    }

    return userInfo;
  }

  /**
   * JWKS 端点
   * GET /oauth/jwks
   */
  @Get('jwks')
  @Public()
  async jwks(): Promise<any> {
    return this.jwksService.getJwks();
  }

  /**
   * OIDC 发现端点
   * GET /.well-known/openid-configuration
   */
  @Get('.well-known/openid-configuration')
  @Public()
  async openidConfiguration(@Req() req: Request): Promise<any> {
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
      jwks_uri: `${baseUrl}/oauth/jwks`,
      revocation_endpoint: `${baseUrl}/oauth/revoke`,
      introspection_endpoint: `${baseUrl}/oauth/introspect`,
      end_session_endpoint: `${baseUrl}/oauth/logout`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'profile', 'email', 'phone', 'offline_access'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      claims_supported: [
        'sub',
        'name',
        'given_name',
        'family_name',
        'picture',
        'email',
        'email_verified',
        'phone_number',
        'phone_number_verified',
      ],
      code_challenge_methods_supported: ['S256', 'plain'],
    };
  }

  /**
   * 登出端点
   * GET /oauth/logout
   */
  @Get('logout')
  @Public()
  async logout(
    @Query('post_logout_redirect_uri') postLogoutRedirectUri: string,
    @Query('id_token_hint') idTokenHint: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // 清除 SSO 会话
    const sessionToken = req.cookies?.['sso_session'];
    if (sessionToken) {
      await this.oauthService.logoutSSOSession(sessionToken);
      res.clearCookie('sso_session');
    }

    if (postLogoutRedirectUri) {
      res.redirect(postLogoutRedirectUri);
      return;
    }

    res.json({ message: 'Logged out successfully' });
  }

  /**
   * 获取权限范围描述
   */
  private getScopeDescription(scope: string): string {
    const descriptions: Record<string, string> = {
      openid: 'Access your user ID',
      profile: 'Access your profile information (name, picture)',
      email: 'Access your email address',
      phone: 'Access your phone number',
      offline_access: 'Access your data when you are not present',
    };
    return descriptions[scope] || scope;
  }
}