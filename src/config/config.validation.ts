import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // 环境配置
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),

  // 数据库配置
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USERNAME: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),

  // Redis 配置
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  // JWT 配置
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TOKEN_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),

  // 邮件配置
  MAIL_HOST: Joi.string().required(),
  MAIL_PORT: Joi.number().default(587),
  MAIL_USER: Joi.string().required(),
  MAIL_PASSWORD: Joi.string().required(),
  MAIL_FROM: Joi.string().required(),

  // 短信配置
  SMS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  SMS_ACCESS_KEY_SECRET: Joi.string().allow('').optional(),
  SMS_SIGN_NAME: Joi.string().allow('').optional(),
  SMS_TEMPLATE_CODE: Joi.string().allow('').optional(),

  // OAuth 配置
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GITHUB_CLIENT_ID: Joi.string().allow('').optional(),
  GITHUB_CLIENT_SECRET: Joi.string().allow('').optional(),

  // 客户端配置
  CLIENT_URL: Joi.string().uri().required(),

  // 安全配置
  RATE_LIMIT_MAX: Joi.number().default(5),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  PASSWORD_SALT_ROUNDS: Joi.number().default(12),

  // MFA 配置
  MFA_ISSUER: Joi.string().default('AuthForge'),
  MFA_SERVICE_NAME: Joi.string().default('AuthForge Auth'),
});