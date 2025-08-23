# AuthForge Dockerfile
# 多阶段构建，优化镜像大小和安全性

# 阶段1: 构建阶段
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装必要的系统依赖
RUN apk add --no-cache python3 make g++ && ln -sf python3 /usr/bin/python

# 复制包管理文件
COPY package*.json ./

# 配置npm镜像源和安装依赖
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm ci --verbose --only=production=false

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 阶段2: 生产阶段
FROM node:18-alpine AS production

# 安装dumb-init用于正确处理信号
RUN apk add --no-cache dumb-init

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 配置npm并安装生产依赖
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm ci --verbose --omit=dev && \
    npm cache clean --force

# 从构建阶段复制构建产物
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/src/database/migrations ./dist/database/migrations

# 创建uploads目录
RUN mkdir -p uploads && chown -R nestjs:nodejs uploads

# 切换到非root用户
USER nestjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node --version || exit 1

# 使用dumb-init作为PID 1
ENTRYPOINT ["dumb-init", "--"]

# 启动应用
CMD ["node", "dist/main"]