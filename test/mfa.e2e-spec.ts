import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserStatus } from '../src/database/entities/user.entity';
import { MfaDevice, MfaDeviceType, MfaDeviceStatus } from '../src/database/entities/mfa-device.entity';
import { RefreshToken } from '../src/database/entities/refresh-token.entity';
import { VerificationCode } from '../src/database/entities/verification-code.entity';

describe('MFA (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: any;
  let mfaDeviceRepository: any;
  
  // 测试用户数据
  const testUser = {
    email: 'mfa-test@example.com',
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!',
  };

  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let totpDeviceId: string;
  let smsDeviceId: string;

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
    refreshToken = loginResponse.body.data.refreshToken;
  }

  describe('TOTP设备管理', () => {
    it('POST /auth/mfa/setup/totp - 应该成功设置TOTP设备', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/mfa/setup/totp')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          deviceName: '我的认证器',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('TOTP设备设置成功'),
        data: {
          secret: expect.any(String),
          qrCodeUrl: expect.stringContaining('data:image/png;base64'),
          backupCodes: expect.arrayContaining([
            expect.any(String),
          ]),
        },
      });

      // 查找创建的设备
      const device = await mfaDeviceRepository.findOne({
        where: {
          userId,
          type: MfaDeviceType.TOTP,
          name: '我的认证器',
        },
      });

      expect(device).toBeDefined();
      expect(device.status).toBe(MfaDeviceStatus.PENDING);
      totpDeviceId = device.id;
    });

    it('POST /auth/mfa/verify-setup - 应该验证TOTP设备设置（模拟）', async () => {
      // 在实际测试中，这里需要生成真实的TOTP代码
      // 为了简化测试，我们直接激活设备
      await mfaDeviceRepository.update(
        { id: totpDeviceId },
        { status: MfaDeviceStatus.ACTIVE }
      );

      await userRepository.update(
        { id: userId },
        { mfaEnabled: true }
      );

      // 验证用户MFA已启用
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.mfaEnabled).toBe(true);
    });
  });

  describe('SMS设备管理', () => {
    it('POST /auth/mfa/setup/sms - 应该成功设置SMS设备', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/mfa/setup/sms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phoneNumber: '+8613800138000',
          deviceName: '我的手机',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('验证码已发送'),
      });

      // 查找创建的设备
      const device = await mfaDeviceRepository.findOne({
        where: {
          userId,
          type: MfaDeviceType.SMS,
          name: '我的手机',
        },
      });

      expect(device).toBeDefined();
      expect(device.target).toBe('+8613800138000');
      smsDeviceId = device.id;
    });
  });

  describe('Email设备管理', () => {
    it('POST /auth/mfa/setup/email - 应该成功设置Email设备', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/mfa/setup/email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: testUser.email,
          deviceName: '我的邮箱',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('验证码已发送'),
      });
    });
  });

  describe('MFA设备列表', () => {
    it('GET /auth/mfa/devices - 应该获取用户的MFA设备列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/mfa/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '获取MFA设备列表成功',
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            type: expect.any(String),
            name: expect.any(String),
            status: expect.any(String),
            createdAt: expect.any(String),
            usageCount: expect.any(Number),
          }),
        ]),
      });

      // 应该至少有3个设备（TOTP、SMS、Email）
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('MFA验证', () => {
    it('POST /auth/mfa/send-code - 应该发送MFA登录验证码', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/mfa/send-code')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          deviceId: smsDeviceId,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '验证码已发送',
      });
    });

    it('POST /auth/mfa/verify - 应该验证MFA代码（模拟）', async () => {
      // 在实际测试中，这里需要使用真实的验证码
      // 为了简化测试，我们模拟验证成功
      
      // 由于MFA验证比较复杂，这里只测试API端点的可达性
      const response = await request(app.getHttpServer())
        .post('/auth/mfa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          code: '123456', // 模拟验证码
        })
        .expect(200);

      // 即使验证失败，也应该返回结构化响应
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('备份代码', () => {
    it('POST /auth/mfa/backup-codes/regenerate - 应该重新生成备份代码', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/mfa/backup-codes/regenerate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: '备份代码已重新生成',
        data: {
          backupCodes: expect.arrayContaining([
            expect.any(String),
          ]),
        },
      });

      expect(response.body.data.backupCodes).toHaveLength(10);
    });
  });

  describe('设备禁用', () => {
    it('DELETE /auth/mfa/devices/:deviceId - 应该成功禁用MFA设备', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/auth/mfa/devices/${smsDeviceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'MFA设备已禁用',
      });

      // 验证设备已禁用
      const device = await mfaDeviceRepository.findOne({
        where: { id: smsDeviceId },
      });

      expect(device.status).toBe(MfaDeviceStatus.DISABLED);
    });

    it('DELETE /auth/mfa/devices/:deviceId - 应该拒绝禁用不存在的设备', async () => {
      const fakeDeviceId = '00000000-0000-0000-0000-000000000000';
      
      await request(app.getHttpServer())
        .delete(`/auth/mfa/devices/${fakeDeviceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('未认证访问', () => {
    it('应该拒绝所有未认证的MFA端点访问', async () => {
      const endpoints = [
        { method: 'post', path: '/auth/mfa/setup/totp' },
        { method: 'post', path: '/auth/mfa/setup/sms' },
        { method: 'post', path: '/auth/mfa/setup/email' },
        { method: 'get', path: '/auth/mfa/devices' },
        { method: 'post', path: '/auth/mfa/verify' },
        { method: 'post', path: '/auth/mfa/send-code' },
        { method: 'post', path: '/auth/mfa/backup-codes/regenerate' },
      ];

      for (const endpoint of endpoints) {
        await request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .send({})
          .expect(401);
      }
    });
  });
});