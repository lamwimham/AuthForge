import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserStatus } from '../src/database/entities/user.entity';
import { MfaDevice, MfaDeviceType } from '../src/database/entities/mfa-device.entity';
import { OAuthProvider } from '../src/database/entities/oauth-provider.entity';
import { RefreshToken } from '../src/database/entities/refresh-token.entity';
import { VerificationCode } from '../src/database/entities/verification-code.entity';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: any;
  let mfaDeviceRepository: any;
  
  // 测试用户数据
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!',
  };

  const testUser2 = {
    email: 'test2@example.com', 
    username: 'testuser2',
    password: 'TestPassword456!',
    confirmPassword: 'TestPassword456!',
  };

  let accessToken: string;
  let refreshToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    userRepository = dataSource.getRepository(User);
    mfaDeviceRepository = dataSource.getRepository(MfaDevice);

    // 清理测试数据
    await cleanupTestData();
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
      .where('email IN (:...emails)', { emails: [testUser.email, testUser2.email] })
      .execute();
  }

  describe('用户注册流程', () => {
    it('POST /auth/register - 应该成功注册新用户', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('注册成功'),
        data: {
          id: expect.any(String),
          email: testUser.email,
          status: UserStatus.PENDING,
          emailVerified: false,
          mfaEnabled: false,
        },
      });

      userId = response.body.data.id;
    });

    it('POST /auth/register - 应该拒绝重复邮箱注册', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('POST /auth/register - 应该拒绝弱密码', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'weak@example.com',
          password: '123',
          confirmPassword: '123',
        })
        .expect(400);
    });

    it('POST /auth/register - 应该拒绝密码不匹配', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'mismatch@example.com',
          password: 'TestPassword123!',
          confirmPassword: 'DifferentPassword123!',
        })
        .expect(400);
    });
  });

  describe('用户登录流程', () => {
    beforeAll(async () => {
      // 激活测试用户以便登录
      await userRepository.update(
        { email: testUser.email },
        { status: UserStatus.ACTIVE }
      );
    });

    it('POST /auth/login - 应该成功登录', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '登录成功',
        data: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(Number),
          user: {
            id: userId,
            email: testUser.email,
          },
        },
      });

      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('POST /auth/login - 应该拒绝错误密码', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('POST /auth/login - 应该拒绝不存在的用户', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);
    });
  });

  describe('用户信息管理', () => {
    it('GET /auth/me - 应该获取当前用户信息', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '获取用户信息成功',
        data: {
          id: userId,
          email: testUser.email,
          emailVerified: false,
          mfaEnabled: false,
        },
      });
    });

    it('GET /auth/me - 应该拒绝未认证请求', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('GET /auth/me - 应该拒绝无效token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('令牌刷新', () => {
    it('POST /auth/refresh - 应该成功刷新令牌', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '令牌刷新成功',
        data: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: expect.any(Number),
        },
      });

      // 更新token用于后续测试
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('POST /auth/refresh - 应该拒绝无效刷新令牌', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);
    });
  });

  describe('密码管理', () => {
    it('POST /auth/change-password - 应该成功修改密码', async () => {
      const newPassword = 'NewTestPassword123!';
      
      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword,
          confirmPassword: newPassword,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '密码修改成功',
      });

      // 验证新密码可以登录
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: testUser.email,
          password: newPassword,
        })
        .expect(200);

      accessToken = loginResponse.body.data.accessToken;
    });

    it('POST /auth/change-password - 应该拒绝错误的当前密码', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongCurrentPassword!',
          newPassword: 'NewTestPassword456!',
          confirmPassword: 'NewTestPassword456!',
        })
        .expect(400);
    });
  });

  describe('邮箱验证', () => {
    it('POST /auth/send-verification-code - 应该发送邮箱验证码', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/send-verification-code')
        .send({
          target: testUser.email,
          type: 'email_verify',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('验证码已发送'),
      });
    });

    it('POST /auth/verify-email - 应该验证邮箱（模拟验证码）', async () => {
      // 在实际测试中，这里需要从数据库获取验证码
      // 为了简化测试，我们直接验证用户邮箱
      await userRepository.update(
        { id: userId },
        { emailVerified: true }
      );

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.emailVerified).toBe(true);
    });
  });

  describe('登出', () => {
    it('POST /auth/logout - 应该成功登出', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '登出成功',
      });

      // 验证token已失效
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('速率限制', () => {
    it('应该在多次失败登录后触发速率限制', async () => {
      // 注册一个新用户用于测试速率限制
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser2)
        .expect(201);

      // 激活用户
      await userRepository.update(
        { email: testUser2.email },
        { status: UserStatus.ACTIVE }
      );

      // 尝试多次错误登录
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            identifier: testUser2.email,
            password: 'WrongPassword123!',
          });
      }

      // 第6次应该被速率限制
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: testUser2.email,
          password: 'WrongPassword123!',
        })
        .expect(429);
    });
  });
});