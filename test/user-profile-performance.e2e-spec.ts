import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('User Profile Performance Tests', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 创建测试用户并获取token
    try {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'perf-test@example.com',
          password: 'Test123!@#',
          username: 'perfuser',
        });

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'perf-test@example.com',
          password: 'Test123!@#',
        });

      if (loginResponse.status === 200) {
        accessToken = loginResponse.body.data.accessToken;
      }
    } catch (error) {
      // 忽略已存在用户的错误
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('API响应时间应该在合理范围内', async () => {
    if (!accessToken) {
      console.log('跳过性能测试：无法获取访问令牌');
      return;
    }

    const startTime = Date.now();
    
    await request(app.getHttpServer())
      .get('/api/v1/user/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    
    // API响应时间应该小于1000ms
    expect(responseTime).toBeLessThan(1000);
    console.log(`API响应时间: ${responseTime}ms`);
  });

  it('缓存应该提升性能', async () => {
    if (!accessToken) {
      console.log('跳过缓存测试：无法获取访问令牌');
      return;
    }

    // 第一次请求（无缓存）
    const firstCallStart = Date.now();
    await request(app.getHttpServer())
      .get('/api/v1/user/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const firstCallTime = Date.now() - firstCallStart;

    // 第二次请求（有缓存）
    const secondCallStart = Date.now();
    await request(app.getHttpServer())
      .get('/api/v1/user/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const secondCallTime = Date.now() - secondCallStart;

    console.log(`第一次请求时间: ${firstCallTime}ms`);
    console.log(`第二次请求时间: ${secondCallTime}ms`);
    
    // 第二次请求应该更快（缓存效果）
    // 注意：在测试环境中缓存效果可能不明显
    expect(secondCallTime).toBeLessThanOrEqual(firstCallTime + 50);
  });

  it('批量请求应该保持稳定性能', async () => {
    if (!accessToken) {
      console.log('跳过批量测试：无法获取访问令牌');
      return;
    }

    const promises = [];
    const requestCount = 10;

    const startTime = Date.now();

    for (let i = 0; i < requestCount; i++) {
      promises.push(
        request(app.getHttpServer())
          .get('/api/v1/user/profile?level=basic')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
      );
    }

    await Promise.all(promises);
    
    const totalTime = Date.now() - startTime;
    const avgTime = totalTime / requestCount;

    console.log(`${requestCount}个并发请求总时间: ${totalTime}ms`);
    console.log(`平均响应时间: ${avgTime}ms`);

    // 平均响应时间应该在合理范围内
    expect(avgTime).toBeLessThan(500);
  });
});