#!/bin/bash

# 开发环境停止脚本

echo "🛑 停止 SpellBackend 认证系统开发环境..."

# 停止所有服务
docker compose down

echo "✅ 开发环境已停止"
echo ""
echo "💡 提示："
echo "   - 重新启动: ./scripts/dev-start.sh"
echo "   - 清理数据: docker compose down -v (⚠️  会删除所有数据)"
echo "   - 查看容器: docker ps -a"