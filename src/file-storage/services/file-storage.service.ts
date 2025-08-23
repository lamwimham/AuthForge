import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileMetadata, FileType } from '../../database/entities/file-metadata.entity';
import {
  FileUploadConfig,
  UploadedFileInfo,
  AVATAR_UPLOAD_CONFIG,
  DOCUMENT_UPLOAD_CONFIG,
  IMAGE_UPLOAD_CONFIG,
} from '../interfaces/file-storage.interface';
import { FileMetadataResponseDto, AvatarUploadResponseDto } from '../dto/file-upload.dto';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly uploadBasePath = 'uploads';

  constructor(
    @InjectRepository(FileMetadata)
    private readonly fileMetadataRepository: Repository<FileMetadata>,
  ) {
    this.ensureUploadDirectories();
  }

  /**
   * 上传头像文件
   */
  async uploadAvatar(
    userId: string,
    file: any,
  ): Promise<AvatarUploadResponseDto> {
    this.logger.log(`上传头像: 用户${userId}, 文件${file.originalname}`);

    this.validateFile(file, AVATAR_UPLOAD_CONFIG);

    try {
      await this.deleteExistingAvatars(userId);
      const uploadedFile = await this.saveFile(file, AVATAR_UPLOAD_CONFIG, FileType.AVATAR);
      const fileMetadata = await this.saveFileMetadata(uploadedFile, userId, FileType.AVATAR);

      const avatarUrl = `/uploads/avatars/${uploadedFile.fileName}`;
      const formattedSize = fileMetadata.getFormattedFileSize();

      this.logger.log(`头像上传成功: ${userId} -> ${avatarUrl}`);

      return new AvatarUploadResponseDto(
        avatarUrl,
        uploadedFile.fileSize,
        formattedSize,
      );
    } catch (error) {
      this.logger.error(`头像上传失败: ${userId}`, error);
      throw new BadRequestException('头像上传失败');
    }
  }

  /**
   * 验证文件
   */
  private validateFile(file: any, config: FileUploadConfig): void {
    if (file.size > config.maxFileSize) {
      throw new BadRequestException(
        `文件大小超出限制，最大允许 ${this.formatFileSize(config.maxFileSize)}`
      );
    }

    if (!config.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`不支持的文件类型: ${file.mimetype}`);
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('文件内容为空');
    }
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private async ensureUploadDirectories(): Promise<void> {
    const directories = [
      AVATAR_UPLOAD_CONFIG.uploadPath,
      DOCUMENT_UPLOAD_CONFIG.uploadPath, 
      IMAGE_UPLOAD_CONFIG.uploadPath,
    ];

    for (const dir of directories) {
      const fullPath = path.join(process.cwd(), dir);
      try {
        await fs.mkdir(fullPath, { recursive: true });
      } catch (error) {
        this.logger.error(`创建上传目录失败: ${fullPath}`, error);
      }
    }
  }

  /**
   * 保存文件到磁盘
   */
  private async saveFile(
    file: any,
    config: FileUploadConfig,
    fileType: FileType,
  ): Promise<UploadedFileInfo> {
    const fileExtension = this.getFileExtension(file.originalname);
    const fileName = `${uuidv4()}.${fileExtension}`;
    const uploadDir = path.join(process.cwd(), config.uploadPath);
    const filePath = path.join(uploadDir, fileName);

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(filePath, file.buffer);

    return {
      originalName: file.originalname,
      fileName,
      filePath,
      fileSize: file.size,
      mimeType: file.mimetype,
      fileType,
    };
  }

  /**
   * 保存文件元数据到数据库
   */
  private async saveFileMetadata(
    uploadedFile: UploadedFileInfo,
    userId: string,
    fileType: FileType,
    description?: string,
  ): Promise<FileMetadata> {
    const fileMetadata = this.fileMetadataRepository.create({
      fileName: uploadedFile.fileName,
      originalName: uploadedFile.originalName,
      filePath: uploadedFile.filePath,
      fileSize: uploadedFile.fileSize,
      mimeType: uploadedFile.mimeType,
      fileType,
      userId,
      description,
    });

    return await this.fileMetadataRepository.save(fileMetadata);
  }

  /**
   * 删除用户现有头像
   */
  private async deleteExistingAvatars(userId: string): Promise<void> {
    const existingAvatars = await this.fileMetadataRepository.find({
      where: {
        userId,
        fileType: FileType.AVATAR,
        isActive: true,
      },
    });

    for (const avatar of existingAvatars) {
      avatar.markAsInactive();
      await this.fileMetadataRepository.save(avatar);
      await this.deletePhysicalFile(avatar.filePath);
    }
  }

  /**
   * 删除物理文件
   */
  private async deletePhysicalFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        this.logger.warn(`删除物理文件失败: ${filePath}`, error);
      }
    }
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(lastDotIndex + 1) : 'bin';
  }
}