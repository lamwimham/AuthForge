import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Req,
  Res,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { OAuthService } from '../services/oauth.service';
import { ApiResponseDto } from '../dto/response.dto';
import type { Request, Response } from 'express';

@ApiTags('OAuth 第三方登录')
@Controller('auth/oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth登录' })
  @ApiResponse({
    status: 302,
    description: '重定向到Google授权页面',
  })
  async googleAuth(@Req() req: Request): Promise<void> {
    // 此方法不需要实现，passport会自动处理重定向
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth回调' })
  @ApiResponse({
    status: 302,
    description: '登录成功后重定向',
  })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = req.user as any;
    
    // 构建重定向URL，包含令牌信息
    const redirectUrl = new URL(
      process.env.FRONTEND_URL || 'http://localhost:3000'
    );
    redirectUrl.pathname = '/auth/callback';
    redirectUrl.searchParams.set('access_token', result.accessToken);
    redirectUrl.searchParams.set('refresh_token', result.refreshToken);
    redirectUrl.searchParams.set('expires_in', result.expiresIn.toString());
    redirectUrl.searchParams.set('is_new_user', result.isNewUser.toString());
    
    res.redirect(redirectUrl.toString());
  }

  @Get('github')
  @Public()
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth登录' })
  @ApiResponse({
    status: 302,
    description: '重定向到GitHub授权页面',
  })
  async githubAuth(@Req() req: Request): Promise<void> {
    // 此方法不需要实现，passport会自动处理重定向
  }

  @Get('github/callback')
  @Public()
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth回调' })
  @ApiResponse({
    status: 302,
    description: '登录成功后重定向',
  })
  async githubCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = req.user as any;
    
    // 构建重定向URL，包含令牌信息
    const redirectUrl = new URL(
      process.env.FRONTEND_URL || 'http://localhost:3000'
    );
    redirectUrl.pathname = '/auth/callback';
    redirectUrl.searchParams.set('access_token', result.accessToken);
    redirectUrl.searchParams.set('refresh_token', result.refreshToken);
    redirectUrl.searchParams.set('expires_in', result.expiresIn.toString());
    redirectUrl.searchParams.set('is_new_user', result.isNewUser.toString());
    
    res.redirect(redirectUrl.toString());
  }

  @Post('link/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '绑定OAuth提供商' })
  @ApiResponse({
    status: 200,
    description: 'OAuth提供商绑定成功',
    type: ApiResponseDto,
  })
  async linkProvider(
    @CurrentUser() user: User,
    @Param('provider') provider: string,
  ): Promise<ApiResponseDto> {
    // 注意：这个端点需要前端引导用户到OAuth授权页面
    // 然后在回调中处理绑定逻辑
    return {
      success: true,
      message: `请访问 /auth/oauth/${provider}?link=true 进行账户绑定`,
      data: {
        linkUrl: `/auth/oauth/${provider}?link=true&user_id=${user.id}`,
      },
    };
  }

  @Delete('unlink/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '解绑OAuth提供商' })
  @ApiResponse({
    status: 200,
    description: 'OAuth提供商解绑成功',
    type: ApiResponseDto,
  })
  async unlinkProvider(
    @CurrentUser() user: User,
    @Param('provider') provider: string,
  ): Promise<ApiResponseDto> {
    await this.oauthService.unlinkOAuthProvider(
      user.id,
      provider as any,
    );

    return {
      success: true,
      message: `${provider} 账户解绑成功`,
    };
  }

  @Get('providers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户绑定的OAuth提供商' })
  @ApiResponse({
    status: 200,
    description: '用户绑定的OAuth提供商列表',
    type: ApiResponseDto,
  })
  async getLinkedProviders(
    @CurrentUser() user: User,
  ): Promise<ApiResponseDto> {
    const providers = await this.oauthService.getUserOAuthProviders(user.id);

    return {
      success: true,
      message: '获取OAuth提供商列表成功',
      data: providers,
    };
  }
}