import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for successful file upload
 */
export class UploadResponseDto {
  @ApiProperty({
    description: 'Unique key/identifier for the uploaded file',
    example: 'avatars/user-123/profile-1234567890.jpg',
  })
  key: string;

  @ApiProperty({
    description: 'Public URL to access the file (if applicable)',
    example: 'https://cdn.example.com/avatars/user-123/profile-1234567890.jpg',
    required: false,
  })
  url?: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1024000,
  })
  size: number;

  @ApiProperty({
    description: 'MIME type of the uploaded file',
    example: 'image/jpeg',
  })
  mimeType: string;

  @ApiProperty({
    description: 'Timestamp when the file was uploaded',
    example: '2024-04-25T10:30:00.000Z',
  })
  uploadedAt: Date;
}

/**
 * Response DTO for signed URL generation
 */
export class SignedUrlResponseDto {
  @ApiProperty({
    description: 'Signed URL for file access',
    example: 'https://s3.amazonaws.com/bucket/file.jpg?signature=...',
  })
  url: string;

  @ApiProperty({
    description: 'Expiration time of the signed URL',
    example: '2024-04-25T11:30:00.000Z',
    required: false,
  })
  expiresAt?: Date;
}
