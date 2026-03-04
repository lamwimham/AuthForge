# AuthForge 用户认证系统

基于 NestJS + TypeScript 构建的企业级用户认证与管理系统，为现代应用提供完整的身份验证解决方案。

## 🚀 核心功能

### 🔐 用户认证
- **用户注册与登录** - 支持邮箱/用户名登录
- **JWT 令牌管理** - 访问令牌 + 刷新令牌机制
- **密码安全** - Argon2 + bcrypt 双重哈希加密
- **多因素认证 (MFA)** - TOTP 时间基准一次性密码
- **OAuth 第三方登录** - Google、GitHub 社交登录

### 👤 用户管理
- **用户资料管理** - 完整的用户信息 CRUD
- **头像上传** - 支持文件上传和管理
- **邮箱/手机验证** - 多渠道验证码系统
- **密码重置** - 安全的密码重置流程

### 🛡️ 安全特性
- **频率限制** - Redis 实现的智能限流
- **设备管理** - 多设备登录管理
- **IP 白名单** - 基于地理位置的安全控制
- **会话管理** - 全局登出和会话失效

### 📧 通知系统
- **邮件服务** - 支持 SMTP 和 Gmail
- **验证码系统** - 注册、重置密码、邮箱验证
- **短信集成** - 阿里云 SMS 服务支持

## 🛠️ 技术栈

- **框架**: NestJS 10.x + TypeScript
- **数据库**: PostgreSQL + TypeORM
- **缓存**: Redis + ioredis
- **认证**: JWT + Passport.js
- **验证**: class-validator + class-transformer
- **文档**: Swagger/OpenAPI 3.0
- **测试**: Jest + Supertest
- **容器化**: Docker + Docker Compose

## 🚦 快速开始

### 环境要求

- Node.js >= 18.x
- PostgreSQL >= 13.x
- Redis >= 6.x
- Docker & Docker Compose (可选)

### 安装和配置

1. **克隆项目**
```bash
git clone git@github.com:lamwimham/AuthForge.git
cd AuthForge
```

2. **安装依赖**
```bash
npm install
```

3. **环境配置**
```bash
# 复制环境配置文件
cp .env.example .env

# 编辑配置文件，设置数据库、Redis、JWT 等配置
vim .env
```

4. **启动数据库服务** (使用 Docker)
```bash
# 启动 PostgreSQL 和 Redis
npm run docker:start

# 停止服务
npm run docker:stop
```

5. **数据库迁移**
```bash
# 运行数据库迁移
npm run db:migrate
```

### 启动应用

```bash
# 开发模式 (热重载)
npm run start:dev

# 生产模式
npm run start:prod

# 调试模式
npm run start:debug
```

应用将在 `http://localhost:3000` 启动
API 文档访问: `http://localhost:3000/api/docs`

## 🧪 测试

```bash
# 单元测试
npm run test

# 测试覆盖率
npm run test:cov

# E2E 测试
npm run test:e2e

# 监听模式测试
npm run test:watch
```

## 📁 项目结构

```
src/
├── auth/                 # 认证模块
│   ├── controllers/      # 认证控制器
│   ├── services/         # 认证服务
│   ├── guards/          # 认证守卫
│   ├── strategies/      # Passport 策略
│   └── dto/             # 数据传输对象
├── user-profile/        # 用户资料模块
├── file-storage/        # 文件存储模块
├── database/            # 数据库配置
│   ├── entities/        # 实体定义
│   └── migrations/      # 数据库迁移
├── common/              # 通用模块
│   ├── decorators/      # 自定义装饰器
│   ├── filters/         # 异常过滤器
│   └── interceptors/    # 拦截器
└── config/              # 配置文件
```

## 🔧 数据库管理

```bash
# 生成新的迁移文件
npm run db:migrate:generate -- src/database/migrations/MigrationName

# 创建空迁移文件
npm run db:migrate:create src/database/migrations/MigrationName

# 执行迁移
npm run db:migrate

# 回滚迁移
npm run db:migrate:revert
```

## 🚀 部署

### Docker 部署

推荐使用 Docker 进行生产环境部署，支持一键式部署。

```bash
# 1. 克隆项目
git clone git@github.com:lamwimham/AuthForge.git
cd AuthForge

# 2. 配置环境变量
cp .env.production.example .env.production
vim .env.production  # 编辑配置文件

# 3. 一键部署
./scripts/deploy-prod.sh
```

**部署包含的服务**：
- 💻 **AuthForge API** - 主应用服务
- 🗄️ **PostgreSQL** - 数据库服务
- 🔴 **Redis** - 缓存服务
- 🌍 **Nginx** - 反向代理和负载均衡

详细部署指南请参考：[Docker 部署文档](./docs/DOCKER_DEPLOYMENT.md)

### 环境变量配置

生产环境需要配置以下关键环境变量：

- `POSTGRES_PASSWORD`: PostgreSQL 数据库密码
- `REDIS_PASSWORD`: Redis 缓存密码  
- `JWT_SECRET`: JWT 签名密钥 (至少 32 字符)
- `MAIL_*`: 邮件服务配置
- `OAUTH_*`: 第三方登录配置

## 📆 API 文档

启动应用后，访问 `/api/docs` 查看完整的 API 文档。

### 主要 API 端点

- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/refresh` - 刷新令牌
- `GET /api/v1/auth/profile` - 获取用户信息
- `POST /api/v1/auth/logout` - 用户登出
- `POST /api/v1/user-profile/upload-avatar` - 上传头像

## 📁 项目文档

更多详细的项目文档请查看 [docs 目录](./docs/README.md)，包含：

- 项目开发总结和架构设计
- 完整的开发文档和指南
- API 设计规范和最佳实践
- 部署和运维指南

## 🧩 功能模块

### 认证模块 (`/auth`)
- 用户注册、登录、登出
- JWT 令牌管理
- MFA 多因素认证
- OAuth 第三方登录
- 密码重置和修改

### 用户资料模块 (`/user-profile`)
- 用户信息管理
- 头像上传
- 个人资料更新

### 文件存储模块 (`/file-storage`)
- 文件上传和管理
- 图片处理和优化

## 🔒 安全考虑

- 所有密码使用 Argon2 + bcrypt 双重哈希
- JWT 令牌采用 RS256 算法签名
- 实现了频率限制防止暴力攻击
- 支持 HTTPS 和 CORS 配置
- 输入验证和数据清理

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/AmazingFeature`
3. 提交更改: `git commit -m 'Add some AmazingFeature'`
4. 推送分支: `git push origin feature/AmazingFeature`
5. 提交 Pull Request

## 📝 开发规范

- 遵循 TypeScript 严格模式
- 使用 ESLint + Prettier 代码格式化
- 单元测试覆盖率要求 > 80%
- 提交信息遵循 Conventional Commits

## 📄 许可证

本项目采用 [Apache 2.0 许可证](LICENSE)。

## 👨‍💻 作者

**Keepin AI Native Team**

## 🆘 支持

如有问题或建议，请提交 Issue 或联系开发团队。
