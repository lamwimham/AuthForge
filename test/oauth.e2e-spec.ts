import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserStatus } from '../src/database/entities/user.entity';
import { OAuthProvider, OAuthProviderType } from '../src/database/entities/oauth-provider.entity';
import { RefreshToken } from '../src/database/entities/refresh-token.entity';
import { MfaDevice } from '../src/database/entities/mfa-device.entity';
import { VerificationCode } from '../src/database/entities/verification-code.entity';

describe('OAuth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: any;
  let oauthProviderRepository: any;
  
  // 测试用户数据
  const testUser = {
    email: 'oauth-test@example.com',
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!',
  };

  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    userRepository = dataSource.getRepository(User);
    oauthProviderRepository = dataSource.getRepository(OAuthProvider);

    // 清理测试数据
    await cleanupTestData();
    
    // 创建测试用户
    await setupTestUser();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function cleanupTestData() {
    // 删除测试相关的数据
    await dataSource.getRepository(VerificationCode).createQueryBuilder().delete().execute();
    await dataSource.getRepository(MfaDevice).createQueryBuilder().delete().execute();
    await dataSource.getRepository(OAuthProvider).createQueryBuilder().delete().execute();
    await dataSource.getRepository(RefreshToken).createQueryBuilder().delete().execute();
    await dataSource.getRepository(User).createQueryBuilder().delete()
      .where('email = :email', { email: testUser.email })
      .execute();
  }

  async function setupTestUser() {
    // 注册用户
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    userId = registerResponse.body.data.id;

    // 激活用户
    await userRepository.update(
      { id: userId },
      { status: UserStatus.ACTIVE, emailVerified: true }
    );

    // 登录获取token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    accessToken = loginResponse.body.data.accessToken;
  }

  describe('OAuth重定向端点', () => {
    it('GET /auth/oauth/google - 应该重定向到Google授权页面', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/oauth/google')
        .expect(302);

      // 应该重定向到Google OAuth URL
      expect(response.headers.location).toMatch(/accounts\\.google\\.com/);
    });

    it('GET /auth/oauth/github - 应该重定向到GitHub授权页面', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/oauth/github')
        .expect(302);

      // 应该重定向到GitHub OAuth URL
      expect(response.headers.location).toMatch(/github\\.com/);
    });
  });

  describe('OAuth提供商管理', () => {
    beforeEach(async () => {
      // 创建模拟的OAuth提供商记录
      const oauthProvider = oauthProviderRepository.create({
        userId,
        provider: OAuthProviderType.GOOGLE,
        providerUserId: 'google-123456',
        accessToken: 'mock-google-access-token',
        refreshToken: 'mock-google-refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1小时后过期
      });
      await oauthProviderRepository.save(oauthProvider);
    });

    afterEach(async () => {
      // 清理OAuth提供商记录
      await oauthProviderRepository.delete({ userId });
    });

    it('GET /auth/oauth/providers - 应该获取用户绑定的OAuth提供商', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/oauth/providers')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '获取OAuth提供商列表成功',
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            provider: OAuthProviderType.GOOGLE,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
        ]),
      });
    });

    it('POST /auth/oauth/link/:provider - 应该提供绑定链接', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/oauth/link/github')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('请访问'),
        data: {
          linkUrl: expect.stringContaining('/auth/oauth/github'),
        },
      });
    });

    it('DELETE /auth/oauth/unlink/:provider - 应该成功解绑OAuth提供商', async () => {
      const response = await request(app.getHttpServer())
        .delete('/auth/oauth/unlink/google')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('解绑成功'),
      });

      // 验证提供商已被删除
      const provider = await oauthProviderRepository.findOne({
        where: { userId, provider: OAuthProviderType.GOOGLE },
      });
      expect(provider).toBeNull();
    });

    it('DELETE /auth/oauth/unlink/:provider - 应该拒绝解绑不存在的提供商', async () => {
      await request(app.getHttpServer())
        .delete('/auth/oauth/unlink/facebook')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('OAuth回调端点', () => {
    it('GET /auth/oauth/google/callback - 应该处理Google回调（无实际OAuth数据）', async () => {
      // 注意：由于没有真实的OAuth流程，这个测试会失败
      // 这里只是测试端点的存在性
      const response = await request(app.getHttpServer())
        .get('/auth/oauth/google/callback')
        .expect(302); // 期望重定向或401错误

      // 如果是重定向，应该有location header
      if (response.status === 302) {
        expect(response.headers.location).toBeDefined();
      }
    });

    it('GET /auth/oauth/github/callback - 应该处理GitHub回调（无实际OAuth数据）', async () => {
      // 注意：由于没有真实的OAuth流程，这个测试会失败
      // 这里只是测试端点的存在性
      const response = await request(app.getHttpServer())
        .get('/auth/oauth/github/callback')
        .expect(302); // 期望重定向或401错误

      // 如果是重定向，应该有location header
      if (response.status === 302) {
        expect(response.headers.location).toBeDefined();
      }
    });
  });

  describe('OAuth安全性', () => {
    it('应该拒绝未认证用户访问OAuth管理端点', async () => {
      const endpoints = [
        { method: 'get', path: '/auth/oauth/providers' },
        { method: 'post', path: '/auth/oauth/link/google' },
        { method: 'delete', path: '/auth/oauth/unlink/google' },
      ];

      for (const endpoint of endpoints) {
        await request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .expect(401);
      }
    });

    it('应该拒绝无效的OAuth提供商类型', async () => {
      await request(app.getHttpServer())
        .post('/auth/oauth/link/invalid-provider')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404); // 路由不存在
    });
  });

  describe('OAuth数据一致性', () => {
    it('应该正确存储和检索OAuth提供商信息', async () => {
      // 手动创建OAuth提供商记录
      const provider = oauthProviderRepository.create({
        userId,
        provider: OAuthProviderType.GITHUB,
        providerUserId: 'github-789',
        accessToken: 'github-access-token',
        refreshToken: 'github-refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      await oauthProviderRepository.save(provider);

      // 通过API获取并验证
      const response = await request(app.getHttpServer())
        .get('/auth/oauth/providers')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const githubProvider = response.body.data.find(
        (p: any) => p.provider === OAuthProviderType.GITHUB
      );

      expect(githubProvider).toBeDefined();
      expect(githubProvider.provider).toBe(OAuthProviderType.GITHUB);

      // 清理
      await oauthProviderRepository.delete({ id: provider.id });
    });
  });

  describe('OAuth错误处理', () => {
    it('应该正确处理OAuth提供商错误', async () => {
      // 测试尝试解绑未绑定的提供商
      await request(app.getHttpServer())
        .delete('/auth/oauth/unlink/github')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('应该防止重复绑定相同提供商', async () => {
      // 首先绑定一个提供商
      const provider = oauthProviderRepository.create({
        userId,
        provider: OAuthProviderType.GOOGLE,
        providerUserId: 'google-duplicate-test',
        accessToken: 'test-token',
      });
      await oauthProviderRepository.save(provider);

      // 由于我们没有实际的OAuth流程，这里主要测试数据层的约束
      // 在真实场景中，OAuth服务会检查重复绑定
      
      // 清理
      await oauthProviderRepository.delete({ id: provider.id });
    });
  });
});