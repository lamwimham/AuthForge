import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../services/oauth.service';

// 定义回调函数类型
type VerifyCallback = (error: any, user?: any) => void;

export interface GitHubProfile {
  id: string;
  username: string;
  displayName: string;
  emails: Array<{ value: string; primary?: boolean; verified?: boolean }>;
  photos: Array<{ value: string }>;
  provider: string;
  _json: {
    login: string;
    id: number;
    name: string;
    email: string;
    avatar_url: string;
    html_url: string;
  };
}

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private configService: ConfigService,
    private oauthService: OAuthService,
  ) {
    super({
      clientID: configService.get('GITHUB_CLIENT_ID') || 'test-client-id',
      clientSecret: configService.get('GITHUB_CLIENT_SECRET') || 'test-client-secret',
      callbackURL: configService.get('GITHUB_CALLBACK_URL') || 'http://localhost:3001/auth/oauth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: GitHubProfile,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const user = await this.oauthService.validateOAuthUser({
        provider: 'github',
        providerId: profile.id,
        email: profile.emails?.[0]?.value || profile._json?.email,
        displayName: profile.displayName || profile._json?.name,
        username: profile.username || profile._json?.login,
        avatar: profile.photos?.[0]?.value || profile._json?.avatar_url,
        accessToken,
        refreshToken,
      });

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
}