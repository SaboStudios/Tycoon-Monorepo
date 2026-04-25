import { IsNotEmpty, IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for file upload metadata
 * Used for validation of upload requests
 */
export class UploadFileDto {
  @ApiProperty({
    description: 'The file to upload',
    type: 'string',
    format: 'binary',
  })
  @IsNotEmpty({ message: 'File is required' })
  file: Express.Multer.File;
}

/**
 * DTO for signed URL request
 */
export class GetSignedUrlDto {
  @ApiProperty({
    description: 'The file key to generate a signed URL for',
    example: 'avatars/user-123/profile.jpg',
    maxLength: 500,
  })
  @IsNotEmpty({ message: 'Key is required' })
  @IsString({ message: 'Key must be a string' })
  @MaxLength(500, { message: 'Key must not exceed 500 characters' })
  @Matches(/^[a-zA-Z0-9\/_\-\.]+$/, {
    message: 'Key contains invalid characters. Only alphanumeric, /, _, -, and . are allowed',
  })
  key: string;
}

/**
 * DTO for download token request
 */
export class DownloadFileDto {
  @ApiProperty({
    description: 'JWT token for file download',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsNotEmpty({ message: 'Token is required' })
  @IsString({ message: 'Token must be a string' })
  token: string;
}

/**
 * DTO for upload metadata (optional fields for future extensibility)
 */
export class UploadMetadataDto {
  @ApiPropertyOptional({
    description: 'Optional description of the file',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Optional tags for the file (comma-separated)',
    example: 'avatar,profile,user',
    maxLength: 200,
  })
  @IsOptional()
  @IsString({ message: 'Tags must be a string' })
  @MaxLength(200, { message: 'Tags must not exceed 200 characters' })
  @Matches(/^[a-zA-Z0-9,_\-]+$/, {
    message: 'Tags contain invalid characters. Only alphanumeric, comma, _, and - are allowed',
  })
  tags?: string;
}
