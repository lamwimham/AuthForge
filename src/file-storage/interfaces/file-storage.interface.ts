export interface FileUploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  uploadPath: string;
  generateThumbnail?: boolean;
  thumbnailSizes?: number[];
}

export interface UploadedFileInfo {
  originalName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
}

export interface ProcessedImageInfo {
  original: UploadedFileInfo;
  thumbnails?: {
    size: number;
    fileName: string;
    filePath: string;
  }[];
}

export interface FileStorageResult {
  id: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  thumbnails?: {
    size: number;
    url: string;
  }[];
}

// 头像配置
export const AVATAR_UPLOAD_CONFIG: FileUploadConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
  ],
  uploadPath: 'uploads/avatars',
  generateThumbnail: true,
  thumbnailSizes: [50, 150, 300], // 小、中、大三种尺寸
};

// 文档配置
export const DOCUMENT_UPLOAD_CONFIG: FileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  uploadPath: 'uploads/documents',
  generateThumbnail: false,
};

// 通用图片配置
export const IMAGE_UPLOAD_CONFIG: FileUploadConfig = {
  maxFileSize: 8 * 1024 * 1024, // 8MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
  uploadPath: 'uploads/images',
  generateThumbnail: true,
  thumbnailSizes: [200, 400, 800],
};