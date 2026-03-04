# AuthForge Docker 部署指南

本文档介绍如何使用 Docker 部署 AuthForge 用户认证系统到生产环境。

## 📋 部署要求

### 系统要求
- Linux 服务器 (Ubuntu 20.04+ / CentOS 8+ 推荐)
- Docker 20.10+
- Docker Compose 2.0+
- 最少 2GB RAM
- 最少 20GB 磁盘空间

### 网络要求
- 开放端口 80 (HTTP)
- 开放端口 443 (HTTPS，推荐)
- 开放端口 3000 (API，可选)

## 🚀 快速部署

### 1. 克隆项目
```bash
git clone git@github.com:lamwimham/AuthForge.git
cd AuthForge
```

### 2. 配置环境变量
```bash
# 复制生产环境配置模板
cp .env.production.example .env.production

# 编辑配置文件
vim .env.production
```

**重要配置项：**
```bash
# 数据库密码（必须修改）
POSTGRES_PASSWORD=your_secure_postgres_password_here

# JWT 密钥（必须修改，至少32字符）
JWT_SECRET=your_super_secure_jwt_secret_key_at_least_32_characters_long

# Redis 密码（推荐设置）
REDIS_PASSWORD=your_secure_redis_password_here
```

### 3. 执行部署
```bash
# 使用自动化脚本部署
./scripts/deploy-prod.sh
```

## 📦 手动部署步骤

如果自动化脚本无法使用，可以按以下步骤手动部署：

### 1. 构建镜像
```bash
docker build -t AuthForge:latest .
```

### 2. 启动服务
```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 3. 运行数据库迁移
```bash
docker-compose -f docker-compose.prod.yml exec AuthForge npm run db:migrate
```

## 🔧 服务管理

### 查看服务状态
```bash
docker-compose -f docker-compose.prod.yml ps
```

### 查看日志
```bash
# 查看所有服务日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose.prod.yml logs -f AuthForge
```

### 重启服务
```bash
# 重启所有服务
docker-compose -f docker-compose.prod.yml restart

# 重启特定服务
docker-compose -f docker-compose.prod.yml restart AuthForge
```

### 停止服务
```bash
docker-compose -f docker-compose.prod.yml down
```

### 完全清理（包括数据卷）
```bash
docker-compose -f docker-compose.prod.yml down -v
```

## 📊 监控和维护

### 健康检查
```bash
# API 健康检查
curl http://localhost:3000/api/v1/health

# 数据库检查
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres

# Redis 检查
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

### 资源监控
```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
df -h
docker system df
```

### 数据备份
```bash
# 备份数据库
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres AuthForge_auth > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份文件上传目录
tar -czf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz uploads/
```

## 🔒 安全配置

### HTTPS 配置

1. **获取 SSL 证书**
```bash
# 使用 Let's Encrypt (certbot)
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
```

2. **配置 Nginx SSL**
```bash
# 编辑 docker/nginx/nginx.conf
# 取消 HTTPS 相关配置的注释
# 将证书文件复制到 docker/nginx/ssl/
```

### 防火墙配置
```bash
# Ubuntu/Debian
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

## 🔄 更新部署

### 更新应用代码
```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建镜像
docker build -t AuthForge:latest .

# 3. 重启应用服务
docker-compose -f docker-compose.prod.yml up -d --no-deps AuthForge

# 4. 运行迁移（如果有）
docker-compose -f docker-compose.prod.yml exec AuthForge npm run db:migrate
```

## 🚨 故障排除

### Docker构建问题

#### 1. npm依赖安装失败

**错误现象：**
```
ERROR: failed to solve: process "/bin/sh -c npm ci --only=production" did not complete successfully: exit code 1
```

**解决方案：**

**方案1：使用优化版Dockerfile（推荐）**
```bash
# 使用优化版Dockerfile构建
docker build -f Dockerfile.optimized -t AuthForge:latest .

# 或使用部署脚本
./scripts/deploy-prod.sh --optimized
```

**方案2：网络问题解决**
- 优化版Dockerfile已配置npm镜像源（registry.npmmirror.com）
- 使用多阶段构建减少网络依赖
- 添加了详细的错误处理和重试机制

**方案3：手动清理后重试**
```bash
# 清理Docker缓存
docker system prune -f
docker builder prune -f

# 重新构建
docker build --no-cache -f Dockerfile.optimized -t AuthForge:latest .
```

#### 2. 构建上下文过大

**解决方案：**
- 项目已包含 `.dockerignore` 文件
- 自动排除 `node_modules`、`dist`、`uploads` 等大目录
- 确保 `.dockerignore` 文件存在并生效

#### 3. 依赖编译失败

**解决方案：**
- 优化版Dockerfile已安装必要编译工具（python3, make, g++）
- 使用Alpine Linux基础镜像减少体积
- 正确配置Python链接

#### 4. 权限问题

**解决方案：**
- 创建专用非root用户（nestjs:nodejs）
- 正确设置文件所有权
- 使用dumb-init处理进程信号

### 常见问题

1. **端口占用**
```bash
# 检查端口占用
sudo netstat -tlnp | grep :3000
# 或
sudo lsof -i :3000
```

2. **数据库连接失败**
```bash
# 检查数据库状态
docker-compose -f docker-compose.prod.yml logs postgres

# 进入数据库容器
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres
```

3. **内存不足**
```bash
# 检查内存使用
free -h
docker stats --no-stream
```

4. **磁盘空间不足**
```bash
# 清理未使用的 Docker 资源
docker system prune -a

# 检查磁盘使用
df -h
```

### 日志分析
```bash
# 应用错误日志
docker-compose -f docker-compose.prod.yml logs AuthForge | grep ERROR

# 数据库日志
docker-compose -f docker-compose.prod.yml logs postgres

# Nginx 访问日志
docker-compose -f docker-compose.prod.yml exec nginx tail -f /var/log/nginx/access.log
```

## 📈 性能优化

### 数据库优化
```sql
-- 连接数据库进行优化
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d AuthForge_auth

-- 查看慢查询
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### 应用优化
- 启用 Redis 缓存
- 配置 Nginx 缓存
- 使用 CDN 加速静态资源
- 定期清理日志文件

## 📞 技术支持

如遇到部署问题，请：
1. 检查日志文件
2. 查阅故障排除章节
3. 提交 GitHub Issue
4. 联系技术支持团队

---

**最后更新**: 2025-08-23  
**版本**: 1.0.0