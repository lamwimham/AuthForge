import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Logger,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { FileStorageService } from '../services/file-storage.service';
import { UserProfileService } from '../../user-profile/services/user-profile.service';
import { AvatarUploadResponseDto, AvatarUploadDto } from '../dto/file-upload.dto';
import { ApiResponseDto } from '../../user-profile/dto/profile-response.dto';

@ApiTags('文件存储')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FileStorageController {
  private readonly logger = new Logger(FileStorageController.name);

  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly userProfileService: UserProfileService,
  ) {}

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '上传用户头像' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '头像文件',
    type: AvatarUploadDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '头像上传成功',
    type: AvatarUploadResponseDto,
  })
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: any,
  ): Promise<ApiResponseDto<AvatarUploadResponseDto>> {
    this.logger.log(`用户${user.id}上传头像: ${file.originalname}`);

    try {
      // 上传头像文件
      const uploadResult = await this.fileStorageService.uploadAvatar(user.id, file);
      
      // 更新用户头像URL
      await this.userProfileService.updateAvatar(user.id, uploadResult.avatar);

      return ApiResponseDto.success(uploadResult, '头像上传成功');
    } catch (error) {
      this.logger.error(`头像上传失败: ${user.id}`, error);
      throw error;
    }
  }
}