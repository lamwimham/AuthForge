import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../services/oauth.service';

export interface GoogleProfile {
  id: string;
  emails: Array<{ value: string; verified: boolean }>;
  displayName: string;
  name: {
    givenName: string;
    familyName: string;
  };
  photos: Array<{ value: string }>;
  provider: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private oauthService: OAuthService,
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID') || 'test-client-id',
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET') || 'test-client-secret',
      callbackURL: configService.get('GOOGLE_CALLBACK_URL') || 'http://localhost:3001/auth/oauth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const user = await this.oauthService.validateOAuthUser({
        provider: 'google',
        providerId: profile.id,
        email: profile.emails[0]?.value,
        displayName: profile.displayName,
        firstName: profile.name?.givenName,
        lastName: profile.name?.familyName,
        avatar: profile.photos[0]?.value,
        accessToken,
        refreshToken,
      });

      done(null, user);
    } catch (error) {
      done(error, false);
    }
  }
}