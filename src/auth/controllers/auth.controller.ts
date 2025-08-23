import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';

import { AuthService } from '../services/auth.service';
import { VerificationCodeService } from '../services/verification-code.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RateLimit } from '../decorators/rate-limit.decorator';

// DTOs
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import {
  RefreshTokenDto,
  LogoutDto,
  ResetPasswordDto,
  ChangePasswordDto,
  SendVerificationCodeDto,
  VerifyCodeDto,
} from '../dto/auth.dto';
import {
  AuthResponseDto,
  ApiResponseDto,
  TokenResponseDto,
  MessageResponseDto,
  UserProfileDto,
} from '../dto/response.dto';

import { User } from '../../database/entities/user.entity';

@ApiTags('认证')
@Controller('auth')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verificationCodeService: VerificationCodeService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({
    status: 201,
    description: '注册成功',
    type: ApiResponseDto<UserProfileDto>,
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 409, description: '用户已存在' })
  @RateLimit({ max: 3, windowMs: 300000 }) // 5分钟内最多3次
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<ApiResponseDto<UserProfileDto>> {
    const user = await this.authService.register(registerDto);
    
    return {
      success: true,
      message: '注册成功，请验证您的邮箱或手机号以激活账户',
      data: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        username: user.username,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        mfaEnabled: user.mfaEnabled,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({
    status: 200,
    description: '登录成功',
    type: ApiResponseDto<AuthResponseDto>,
  })
  @ApiResponse({ status: 401, description: '认证失败' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @RateLimit({ max: 5, windowMs: 900000 }) // 15分钟内最多5次
  async login(
    @Body() loginDto: LoginDto,
    @Headers('user-agent') userAgent: string,
    @Ip() ipAddress: string,
  ): Promise<ApiResponseDto<AuthResponseDto>> {
    const deviceInfo = loginDto.deviceInfo || userAgent;
    const result = await this.authService.login({
      ...loginDto,
      deviceInfo,
      ipAddress,
    });

    if (result.mfaRequired) {
      return {
        success: false,
        message: '需要进行MFA验证',
        data: { mfaRequired: true } as any,
      };
    }

    return {
      success: true,
      message: '登录成功',
      data: result,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新访问令牌' })
  @ApiResponse({
    status: 200,
    description: '令牌刷新成功',
    type: ApiResponseDto<TokenResponseDto>,
  })
  @ApiResponse({ status: 401, description: '刷新令牌无效' })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<ApiResponseDto<TokenResponseDto>> {
    const tokens = await this.authService.refreshToken(refreshTokenDto.refreshToken);
    
    return {
      success: true,
      message: '令牌刷新成功',
      data: tokens,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '用户登出' })
  @ApiResponse({
    status: 200,
    description: '登出成功',
    type: ApiResponseDto<MessageResponseDto>,
  })
  async logout(
    @Body() logoutDto: LogoutDto,
    @Headers('authorization') authorization?: string,
  ): Promise<ApiResponseDto<MessageResponseDto>> {
    const accessToken = authorization?.replace('Bearer ', '');
    await this.authService.logout(logoutDto.refreshToken, accessToken);
    
    return {
      success: true,
      message: '登出成功',
    };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '登出所有设备' })
  @ApiResponse({
    status: 200,
    description: '已登出所有设备',
    type: ApiResponseDto<MessageResponseDto>,
  })
  async logoutAll(
    @CurrentUser() user: User,
    @Headers('authorization') authorization?: string,
  ): Promise<ApiResponseDto<MessageResponseDto>> {
    const accessToken = authorization?.replace('Bearer ', '');
    await this.authService.logoutAll(user.id, accessToken);
    
    return {
      success: true,
      message: '已登出所有设备',
    };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: ApiResponseDto<UserProfileDto>,
  })
  async getCurrentUser(
    @CurrentUser() user: User,
  ): Promise<ApiResponseDto<UserProfileDto>> {
    const profile = await this.authService.getUserProfile(user.id);
    
    return {
      success: true,
      message: '获取用户信息成功',
      data: profile,
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重置密码' })
  @ApiResponse({
    status: 200,
    description: '密码重置成功',
    type: ApiResponseDto<MessageResponseDto>,
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '验证码无效' })
  @RateLimit({ max: 3, windowMs: 600000 }) // 10分钟内最多3次
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<ApiResponseDto<MessageResponseDto>> {
    await this.authService.resetPassword(resetPasswordDto);
    
    return {
      success: true,
      message: '密码重置成功',
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({
    status: 200,
    description: '密码修改成功',
    type: ApiResponseDto<MessageResponseDto>,
  })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '当前密码错误' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<ApiResponseDto<MessageResponseDto>> {
    await this.authService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
      changePasswordDto.confirmPassword,
    );
    
    return {
      success: true,
      message: '密码修改成功',
    };
  }

  @Public()
  @Post('send-verification-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送验证码' })
  @ApiResponse({
    status: 200,
    description: '验证码发送成功',
    type: ApiResponseDto<MessageResponseDto>,
  })
  @ApiResponse({ status: 429, description: '发送过于频繁' })
  @RateLimit({ max: 3, windowMs: 300000 }) // 5分钟内最多3次
  async sendVerificationCode(
    @Body() sendCodeDto: SendVerificationCodeDto,
  ): Promise<ApiResponseDto<MessageResponseDto>> {
    await this.verificationCodeService.sendVerificationCode(
      sendCodeDto.target,
      sendCodeDto.type,
    );
    
    return {
      success: true,
      message: '验证码已发送，请注意查收',
    };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '验证邮箱' })
  @ApiResponse({
    status: 200,
    description: '邮箱验证成功',
    type: ApiResponseDto<MessageResponseDto>,
  })
  @ApiResponse({ status: 401, description: '验证码无效' })
  async verifyEmail(
    @CurrentUser() user: User,
    @Body() verifyCodeDto: VerifyCodeDto,
  ): Promise<ApiResponseDto<MessageResponseDto>> {
    await this.authService.verifyEmail(user.id, verifyCodeDto.verificationCode);
    
    return {
      success: true,
      message: '邮箱验证成功',
    };
  }

  @Post('verify-phone')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '验证手机号' })
  @ApiResponse({
    status: 200,
    description: '手机号验证成功',
    type: ApiResponseDto<MessageResponseDto>,
  })
  @ApiResponse({ status: 401, description: '验证码无效' })
  async verifyPhone(
    @CurrentUser() user: User,
    @Body() verifyCodeDto: VerifyCodeDto,
  ): Promise<ApiResponseDto<MessageResponseDto>> {
    await this.authService.verifyPhone(user.id, verifyCodeDto.verificationCode);
    
    return {
      success: true,
      message: '手机号验证成功',
    };
  }
}