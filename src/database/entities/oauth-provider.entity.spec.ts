import { OAuthProvider, OAuthProviderType } from './oauth-provider.entity';

describe('OAuthProvider Entity', () => {
  let oauthProvider: OAuthProvider;

  beforeEach(() => {
    oauthProvider = new OAuthProvider();
    oauthProvider.id = 'test-oauth-id';
    oauthProvider.userId = 'test-user-id';
    oauthProvider.provider = OAuthProviderType.GOOGLE;
    oauthProvider.providerUserId = 'google-user-123';
    oauthProvider.accessToken = 'access-token-123';
    oauthProvider.refreshToken = 'refresh-token-123';
    oauthProvider.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    oauthProvider.createdAt = new Date();
    oauthProvider.updatedAt = new Date();
  });

  describe('isTokenExpired', () => {
    it('should return false when expiresAt is null', () => {
      oauthProvider.expiresAt = null;
      expect(oauthProvider.isTokenExpired()).toBe(false);
    });

    it('should return false for future expiry date', () => {
      oauthProvider.expiresAt = new Date(Date.now() + 10000);
      expect(oauthProvider.isTokenExpired()).toBe(false);
    });

    it('should return true for past expiry date', () => {
      oauthProvider.expiresAt = new Date(Date.now() - 10000);
      expect(oauthProvider.isTokenExpired()).toBe(true);
    });
  });

  describe('updateTokens', () => {
    it('should update access token', () => {
      const newAccessToken = 'new-access-token';
      oauthProvider.updateTokens(newAccessToken);
      expect(oauthProvider.accessToken).toBe(newAccessToken);
    });

    it('should update refresh token when provided', () => {
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';
      oauthProvider.updateTokens(newAccessToken, newRefreshToken);
      
      expect(oauthProvider.accessToken).toBe(newAccessToken);
      expect(oauthProvider.refreshToken).toBe(newRefreshToken);
    });
  });

  describe('OAuthProviderType Enum', () => {
    it('should have correct enum values', () => {
      expect(OAuthProviderType.GOOGLE).toBe('google');
      expect(OAuthProviderType.GITHUB).toBe('github');
      expect(OAuthProviderType.WECHAT).toBe('wechat');
      expect(OAuthProviderType.APPLE).toBe('apple');
    });
  });

  describe('properties', () => {
    it('should have all required properties', () => {
      expect(oauthProvider.id).toBeDefined();
      expect(oauthProvider.userId).toBeDefined();
      expect(oauthProvider.provider).toBeDefined();
      expect(oauthProvider.providerUserId).toBeDefined();
      expect(oauthProvider.createdAt).toBeDefined();
      expect(oauthProvider.updatedAt).toBeDefined();
    });
  });
});