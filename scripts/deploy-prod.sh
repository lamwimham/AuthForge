#!/bin/bash

# AuthForge 生产环境部署脚本
# 用途：自动化Docker部署流程

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必需的文件
check_required_files() {
    log_info "检查必需的文件..."
    
    local required_files=(
        "Dockerfile"
        "docker-compose.prod.yml"
        "nginx.conf"
        ".env.prod"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            if [ "$file" = ".env.prod" ]; then
                log_warn "未找到 $file，请复制 .env.prod.example 并修改配置"
                if [ -f ".env.prod.example" ]; then
                    cp .env.prod.example .env.prod
                    log_info "已创建 .env.prod 文件，请编辑其中的配置"
                    exit 1
                fi
            else
                log_error "缺少必需文件: $file"
                exit 1
            fi
        fi
    done
    
    log_info "所有必需文件检查完成"
}

# 检查Docker和Docker Compose
check_docker() {
    log_info "检查Docker环境..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker服务未启动，请启动Docker服务"
        exit 1
    fi
    
    log_info "Docker环境检查通过"
}

# 构建镜像
build_image() {
    log_info "构建Docker镜像..."
    
    # 选择Dockerfile
    local dockerfile="Dockerfile"
    if [ -f "Dockerfile.optimized" ] && [ "$USE_OPTIMIZED" = true ]; then
        dockerfile="Dockerfile.optimized"
        log_info "使用优化版Dockerfile: $dockerfile"
    fi
    
    # 设置构建参数
    local build_args=""
    if [ -f ".env.prod" ]; then
        build_args="--env-file .env.prod"
    fi
    
    # 构建镜像
    docker build -f "$dockerfile" -t AuthForge:latest .
    
    if [ $? -eq 0 ]; then
        log_info "Docker镜像构建成功"
    else
        log_error "Docker镜像构建失败"
        exit 1
    fi
}

# 停止现有服务
stop_services() {
    log_info "停止现有服务..."
    
    if docker-compose -f docker-compose.prod.yml ps -q | grep -q .; then
        docker-compose -f docker-compose.prod.yml down
        log_info "现有服务已停止"
    else
        log_info "没有运行中的服务"
    fi
}

# 启动服务
start_services() {
    log_info "启动服务..."
    
    # 加载环境变量
    if [ -f ".env.prod" ]; then
        export $(cat .env.prod | grep -v '#' | awk '/=/ {print $1}')
    fi
    
    # 启动服务
    docker-compose -f docker-compose.prod.yml up -d
    
    if [ $? -eq 0 ]; then
        log_info "服务启动成功"
    else
        log_error "服务启动失败"
        exit 1
    fi
}

# 等待服务健康检查
wait_for_health() {
    log_info "等待服务健康检查..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost/api/health &> /dev/null; then
            log_info "服务健康检查通过"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo "等待服务启动... ($attempt/$max_attempts)"
        sleep 10
    done
    
    log_error "服务健康检查失败，请检查日志"
    return 1
}

# 显示服务状态
show_status() {
    log_info "服务状态:"
    docker-compose -f docker-compose.prod.yml ps
    
    echo ""
    log_info "访问地址:"
    echo "  API文档: http://localhost/api/docs"
    echo "  健康检查: http://localhost/api/health"
    
    echo ""
    log_info "查看日志命令:"
    echo "  所有服务: docker-compose -f docker-compose.prod.yml logs -f"
    echo "  应用服务: docker-compose -f docker-compose.prod.yml logs -f app"
    echo "  数据库: docker-compose -f docker-compose.prod.yml logs -f postgres"
}

# 清理函数
cleanup() {
    log_info "清理未使用的Docker资源..."
    docker system prune -f
    docker volume prune -f
}

# 主函数
main() {
    log_info "开始部署 AuthForge 到生产环境"
    
    # 解析命令行参数
    local BUILD_ONLY=false
    local CLEANUP=false
    local USE_OPTIMIZED=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --build-only)
                BUILD_ONLY=true
                shift
                ;;
            --cleanup)
                CLEANUP=true
                shift
                ;;
            --optimized)
                USE_OPTIMIZED=true
                shift
                ;;
            --help|-h)
                echo "用法: $0 [选项]"
                echo "选项:"
                echo "  --build-only  只构建镜像，不启动服务"
                echo "  --cleanup     清理未使用的Docker资源"
                echo "  --optimized   使用优化版Dockerfile"
                echo "  --help        显示此帮助信息"
                exit 0
                ;;
            *)
                log_error "未知选项: $1"
                exit 1
                ;;
        esac
    done
    
    # 执行清理
    if [ "$CLEANUP" = true ]; then
        cleanup
        exit 0
    fi
    
    # 检查环境
    check_required_files
    check_docker
    
    # 构建镜像
    build_image
    
    # 如果只构建，则退出
    if [ "$BUILD_ONLY" = true ]; then
        log_info "镜像构建完成"
        exit 0
    fi
    
    # 部署服务
    stop_services
    start_services
    
    # 等待服务启动
    if wait_for_health; then
        show_status
        log_info "部署完成！"
    else
        log_error "部署失败，请检查服务日志"
        docker-compose -f docker-compose.prod.yml logs --tail=50
        exit 1
    fi
}

# 执行主函数
main "$@"