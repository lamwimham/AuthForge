import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value);
    const errors = await validate(object, {
      whitelist: true, // 自动删除不在DTO中的属性
      forbidNonWhitelisted: true, // 如果有非白名单属性则抛出错误
      transform: true, // 自动转换类型
      validateCustomDecorators: true, // 验证自定义装饰器
    });

    if (errors.length > 0) {
      const errorMessages = this.buildErrorMessage(errors);
      throw new BadRequestException({
        message: '验证失败',
        errors: errorMessages,
      });
    }

    return object;
  }

  private toValidate(metatype: any): boolean {
    const types: any[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private buildErrorMessage(errors: any[]): any[] {
    return errors.map(error => ({
      property: error.property,
      value: error.value,
      constraints: error.constraints,
      children: error.children?.length > 0 ? this.buildErrorMessage(error.children) : undefined,
    }));
  }
}