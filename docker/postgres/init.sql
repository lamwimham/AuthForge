-- PostgreSQL 初始化脚本
-- 创建用户认证系统所需的数据库和扩展

-- 确保数据库存在
SELECT 'CREATE DATABASE spellbackend_auth'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'spellbackend_auth')\gexec

-- 连接到数据库
\c spellbackend_auth;

-- 创建UUID扩展（用于生成UUID主键）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建pgcrypto扩展（用于加密功能）
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 创建用户状态枚举类型
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'locked', 'disabled', 'pending');
    END IF;
END $$;

-- 创建OAuth提供商枚举类型
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'oauth_provider') THEN
        CREATE TYPE oauth_provider AS ENUM ('google', 'github', 'wechat', 'apple');
    END IF;
END $$;

-- 创建验证码类型枚举
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_type') THEN
        CREATE TYPE verification_type AS ENUM ('register', 'reset_password', 'login_mfa', 'email_verify', 'phone_verify');
    END IF;
END $$;

-- 打印初始化完成信息
SELECT 'PostgreSQL 数据库初始化完成' as message;