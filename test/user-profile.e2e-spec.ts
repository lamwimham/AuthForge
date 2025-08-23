import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('User Profile E2E', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('应该完成完整的用户信息管理流程', async () => {
    // 测试用户注册
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Test123!@#',
        username: 'testuser',
      })
      .expect(201);

    expect(registerResponse.body.success).toBe(true);

    // 测试用户登录
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test123!@#',
      })
      .expect(200);

    expect(loginResponse.body.success).toBe(true);
    accessToken = loginResponse.body.data.accessToken;
    userId = loginResponse.body.data.user.id;

    // 测试获取用户基础信息
    const basicInfoResponse = await request(app.getHttpServer())
      .get('/api/v1/user/profile?level=basic')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(basicInfoResponse.body.success).toBe(true);
    expect(basicInfoResponse.body.data.id).toBe(userId);

    // 测试获取完整用户信息
    const fullProfileResponse = await request(app.getHttpServer())
      .get('/api/v1/user/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(fullProfileResponse.body.success).toBe(true);
    expect(fullProfileResponse.body.data.id).toBe(userId);
    expect(fullProfileResponse.body.data.profileComplete).toBe(false);

    // 测试更新用户信息
    const updateProfileResponse = await request(app.getHttpServer())
      .put('/api/v1/user/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        firstName: 'John',
        lastName: 'Doe',
        bio: 'Software Engineer',
        birthday: '1990-01-15',
        gender: 'male',
      })
      .expect(200);

    expect(updateProfileResponse.body.success).toBe(true);
    expect(updateProfileResponse.body.data.firstName).toBe('John');
    expect(updateProfileResponse.body.data.lastName).toBe('Doe');
    expect(updateProfileResponse.body.data.profileComplete).toBe(true);

    // 测试获取用户统计信息
    const statsResponse = await request(app.getHttpServer())
      .get('/api/v1/user/stats')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(statsResponse.body.success).toBe(true);
    expect(statsResponse.body.data.hasBasicInfo).toBe(true);
    expect(statsResponse.body.data.profileCompletionRate).toBeGreaterThan(50);
  });

  it('应该正确处理无效的更新数据', async () => {
    // 首先登录获取token（简化测试，实际中应该复用）
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

    if (loginResponse.status === 200) {
      accessToken = loginResponse.body.data.accessToken;

      // 测试无效的生日（未来日期）
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      await request(app.getHttpServer())
        .put('/api/v1/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          birthday: futureDate.toISOString(),
        })
        .expect(400);

      // 测试过长的名字
      await request(app.getHttpServer())
        .put('/api/v1/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'a'.repeat(100),
        })
        .expect(400);
    }
  });

  it('应该正确处理未授权的请求', async () => {
    // 测试没有token的请求
    await request(app.getHttpServer())
      .get('/api/v1/user/profile')
      .expect(401);

    // 测试无效token的请求
    await request(app.getHttpServer())
      .get('/api/v1/user/profile')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });
});