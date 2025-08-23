import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FileType } from '../../database/entities/file-metadata.entity';

export class FileUploadDto {
  @ApiProperty({
    description: '文件类型',
    enum: FileType,
  })
  @IsEnum(FileType)
  fileType: FileType;

  @ApiPropertyOptional({
    description: '文件描述',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class FileMetadataResponseDto {
  @ApiProperty({ description: '文件ID' })
  id: string;

  @ApiProperty({ description: '文件名' })
  fileName: string;

  @ApiProperty({ description: '原始文件名' })
  originalName: string;

  @ApiProperty({ description: '文件URL' })
  fileUrl: string;

  @ApiProperty({ description: '文件大小（字节）' })
  fileSize: number;

  @ApiProperty({ description: '文件MIME类型' })
  mimeType: string;

  @ApiProperty({ description: '文件类型', enum: FileType })
  fileType: FileType;

  @ApiProperty({ description: '格式化的文件大小' })
  formattedSize: string;

  @ApiPropertyOptional({ description: '文件描述' })
  description?: string;

  @ApiProperty({ description: '是否为图片' })
  isImage: boolean;

  @ApiProperty({ description: '上传时间' })
  createdAt: Date;

  @ApiPropertyOptional({ 
    description: '缩略图',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        size: { type: 'number' },
        url: { type: 'string' },
      },
    },
  })
  thumbnails?: {
    size: number;
    url: string;
  }[];

  constructor(fileMetadata: any, baseUrl: string = '') {
    this.id = fileMetadata.id;
    this.fileName = fileMetadata.fileName;
    this.originalName = fileMetadata.originalName;
    this.fileUrl = `${baseUrl}${fileMetadata.getFileUrl()}`;
    this.fileSize = fileMetadata.fileSize;
    this.mimeType = fileMetadata.mimeType;
    this.fileType = fileMetadata.fileType;
    this.formattedSize = fileMetadata.getFormattedFileSize();
    this.description = fileMetadata.description;
    this.isImage = fileMetadata.isImage();
    this.createdAt = fileMetadata.createdAt;
  }
}

export class AvatarUploadResponseDto {
  @ApiProperty({ description: '头像URL' })
  avatar: string;

  @ApiPropertyOptional({ 
    description: '缩略图',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        size: { type: 'number' },
        url: { type: 'string' },
      },
    },
  })
  thumbnails?: {
    size: number;
    url: string;
  }[];

  @ApiProperty({ description: '文件大小（字节）' })
  fileSize: number;

  @ApiProperty({ description: '格式化的文件大小' })
  formattedSize: string;

  constructor(avatarUrl: string, fileSize: number, formattedSize: string, thumbnails?: { size: number; url: string }[]) {
    this.avatar = avatarUrl;
    this.fileSize = fileSize;
    this.formattedSize = formattedSize;
    this.thumbnails = thumbnails;
  }
}