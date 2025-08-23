import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  IsDate,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../../database/entities/user.entity';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: '名字',
    example: 'John',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50, { message: '名字长度应在1-50个字符之间' })
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @ApiPropertyOptional({
    description: '姓氏',
    example: 'Doe',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(1, 50, { message: '姓氏长度应在1-50个字符之间' })
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @ApiPropertyOptional({
    description: '个人简介',
    example: 'Software Engineer passionate about technology',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '个人简介不能超过500个字符' })
  @Transform(({ value }) => value?.trim())
  bio?: string;

  @ApiPropertyOptional({
    description: '生日',
    example: '1990-01-15',
    type: Date,
  })
  @IsOptional()
  @IsDate({ message: '生日格式不正确' })
  @Type(() => Date)
  @Transform(({ value }) => {
    if (value && value > new Date()) {
      throw new Error('生日不能是未来日期');
    }
    return value;
  })
  birthday?: Date;

  @ApiPropertyOptional({
    description: '性别',
    example: 'male',
    enum: Gender,
  })
  @IsOptional()
  @IsEnum(Gender, { message: '性别必须是 male、female 或 other' })
  gender?: Gender;
}