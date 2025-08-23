import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum FileType {
  AVATAR = 'avatar',
  DOCUMENT = 'document',
  IMAGE = 'image',
  OTHER = 'other',
}

@Entity('file_metadata')
@Index(['userId', 'fileType'])
@Index(['createdAt'])
export class FileMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({
    name: 'file_type',
    type: 'enum',
    enum: FileType,
    default: FileType.OTHER,
  })
  fileType: FileType;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'description', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // 业务方法
  /**
   * 获取文件URL (相对路径)
   */
  getFileUrl(): string {
    return `/uploads/${this.fileType}/${this.fileName}`;
  }

  /**
   * 获取文件扩展名
   */
  getFileExtension(): string {
    const lastDotIndex = this.fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? this.fileName.substring(lastDotIndex + 1) : '';
  }

  /**
   * 格式化文件大小
   */
  getFormattedFileSize(): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = this.fileSize;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 检查是否为图片文件
   */
  isImage(): boolean {
    const imageMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];
    return imageMimeTypes.includes(this.mimeType);
  }

  /**
   * 标记文件为非活跃状态（软删除）
   */
  markAsInactive(): void {
    this.isActive = false;
  }
}