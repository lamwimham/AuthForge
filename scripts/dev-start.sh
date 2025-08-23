#!/bin/bash

# 开发环境启动脚本

echo "🚀 启动 AuthForge 认证系统开发环境..."

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker"
    exit 1
fi

# 启动数据库服务
echo "📦 启动 PostgreSQL 和 Redis 服务..."
docker compose up -d postgres redis

# 等待服务启动
echo "⏳ 等待数据库服务启动..."
sleep 10

# 检查服务健康状态
echo "🔍 检查服务状态..."
docker compose ps

# 显示连接信息
echo ""
echo "✅ 开发环境启动完成！"
echo ""
echo "📋 服务连接信息："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐘 PostgreSQL:"
echo "   - 主机: localhost"
echo "   - 端口: 5433"
echo "   - 数据库: AuthForge_auth"
echo "   - 用户名: postgres"
echo "   - 密码: postgres"
echo ""
echo "🔴 Redis:"
echo "   - 主机: localhost"
echo "   - 端口: 6379"
echo "   - 无密码"
echo ""
echo "🛠️  可选管理工具："
echo "   - PgAdmin: http://localhost:8080 (admin@AuthForge.com/admin123)"
echo "   - Redis Commander: http://localhost:8081"
echo ""
echo "💡 启动管理工具: docker compose up -d pgadmin redis-commander"
echo "🔄 查看日志: docker compose logs -f"
echo "⏹️  停止服务: docker compose down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"