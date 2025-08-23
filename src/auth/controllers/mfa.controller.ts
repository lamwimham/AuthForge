import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { MfaService } from '../services/mfa.service';
import {
  SetupTotpDto,
  SetupSmsDto,
  SetupEmailDto,
  VerifyMfaSetupDto,
  VerifyMfaCodeDto,
  SendMfaCodeDto,
  DisableMfaDeviceDto,
  MfaSetupResponseDto,
  MfaDeviceResponseDto,
  MfaVerificationResponseDto,
} from '../dto/mfa.dto';
import { ApiResponseDto } from '../dto/response.dto';

@ApiTags('MFA 多因素认证')
@Controller('auth/mfa')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('setup/totp')
  @ApiOperation({ summary: '设置TOTP认证器' })
  @ApiResponse({
    status: 201,
    description: 'TOTP设置成功',
    type: ApiResponseDto<MfaSetupResponseDto>,
  })
  async setupTotp(
    @CurrentUser() user: User,
    @Body() setupTotpDto: SetupTotpDto,
  ): Promise<ApiResponseDto<MfaSetupResponseDto>> {
    const result = await this.mfaService.setupTotpDevice(
      user.id,
      setupTotpDto.deviceName,
    );

    return {
      success: true,
      message: 'TOTP设备设置成功，请扫描二维码并输入验证码完成设置',
      data: result,
    };
  }

  @Post('setup/sms')
  @ApiOperation({ summary: '设置SMS短信认证' })
  @ApiResponse({
    status: 201,
    description: 'SMS设置成功',
    type: ApiResponseDto,
  })
  async setupSms(
    @CurrentUser() user: User,
    @Body() setupSmsDto: SetupSmsDto,
  ): Promise<ApiResponseDto> {
    await this.mfaService.setupSmsDevice(
      user.id,
      setupSmsDto.phoneNumber,
      setupSmsDto.deviceName,
    );

    return {
      success: true,
      message: '短信验证码已发送，请输入收到的验证码完成设置',
    };
  }

  @Post('setup/email')
  @ApiOperation({ summary: '设置Email邮箱认证' })
  @ApiResponse({
    status: 201,
    description: 'Email设置成功',
    type: ApiResponseDto,
  })
  async setupEmail(
    @CurrentUser() user: User,
    @Body() setupEmailDto: SetupEmailDto,
  ): Promise<ApiResponseDto> {
    await this.mfaService.setupEmailDevice(
      user.id,
      setupEmailDto.email,
      setupEmailDto.deviceName,
    );

    return {
      success: true,
      message: '邮箱验证码已发送，请输入收到的验证码完成设置',
    };
  }

  @Post('verify-setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证MFA设备设置' })
  @ApiResponse({
    status: 200,
    description: 'MFA设备验证成功',
    type: ApiResponseDto,
  })
  async verifyMfaSetup(
    @CurrentUser() user: User,
    @Body() verifySetupDto: VerifyMfaSetupDto,
  ): Promise<ApiResponseDto> {
    await this.mfaService.verifyMfaSetup(
      user.id,
      verifySetupDto.deviceId,
      verifySetupDto.code,
    );

    return {
      success: true,
      message: 'MFA设备设置完成',
    };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证MFA代码' })
  @ApiResponse({
    status: 200,
    description: 'MFA验证结果',
    type: ApiResponseDto<MfaVerificationResponseDto>,
  })
  async verifyMfaCode(
    @CurrentUser() user: User,
    @Body() verifyCodeDto: VerifyMfaCodeDto,
  ): Promise<ApiResponseDto<MfaVerificationResponseDto>> {
    const result = await this.mfaService.verifyMfaCode(
      user.id,
      verifyCodeDto.code,
    );

    return {
      success: result.success,
      message: result.success ? 'MFA验证成功' : 'MFA验证失败',
      data: {
        success: result.success,
        backupCodeUsed: result.backupCodeUsed,
        deviceUsed: result.deviceUsed
          ? {
              id: result.deviceUsed.id,
              type: result.deviceUsed.type,
              name: result.deviceUsed.name,
            }
          : undefined,
      },
    };
  }

  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送MFA登录验证码' })
  @ApiResponse({
    status: 200,
    description: '验证码发送成功',
    type: ApiResponseDto,
  })
  async sendMfaCode(
    @CurrentUser() user: User,
    @Body() sendCodeDto: SendMfaCodeDto,
  ): Promise<ApiResponseDto> {
    await this.mfaService.sendMfaLoginCode(user.id, sendCodeDto.deviceId);

    return {
      success: true,
      message: '验证码已发送',
    };
  }

  @Get('devices')
  @ApiOperation({ summary: '获取用户的MFA设备列表' })
  @ApiResponse({
    status: 200,
    description: 'MFA设备列表',
    type: ApiResponseDto<MfaDeviceResponseDto[]>,
  })
  async getMfaDevices(
    @CurrentUser() user: User,
  ): Promise<ApiResponseDto<MfaDeviceResponseDto[]>> {
    const devices = await this.mfaService.getUserMfaDevices(user.id);

    return {
      success: true,
      message: '获取MFA设备列表成功',
      data: devices.map(device => ({
        id: device.id,
        type: device.type,
        name: device.name,
        status: device.status,
        target: device.target,
        createdAt: device.createdAt,
        lastUsedAt: device.lastUsedAt,
        usageCount: device.usageCount,
      })),
    };
  }

  @Delete('devices/:deviceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '禁用MFA设备' })
  @ApiResponse({
    status: 200,
    description: 'MFA设备禁用成功',
    type: ApiResponseDto,
  })
  async disableMfaDevice(
    @CurrentUser() user: User,
    @Param('deviceId') deviceId: string,
  ): Promise<ApiResponseDto> {
    await this.mfaService.disableMfaDevice(user.id, deviceId);

    return {
      success: true,
      message: 'MFA设备已禁用',
    };
  }

  @Post('backup-codes/regenerate')
  @ApiOperation({ summary: '重新生成备份代码' })
  @ApiResponse({
    status: 200,
    description: '备份代码重新生成成功',
    type: ApiResponseDto<{ backupCodes: string[] }>,
  })
  async regenerateBackupCodes(
    @CurrentUser() user: User,
  ): Promise<ApiResponseDto<{ backupCodes: string[] }>> {
    const backupCodes = await this.mfaService.regenerateBackupCodes(user.id);

    return {
      success: true,
      message: '备份代码已重新生成',
      data: { backupCodes },
    };
  }
}