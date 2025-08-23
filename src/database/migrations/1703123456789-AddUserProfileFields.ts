import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddUserProfileFields1703123456789 implements MigrationInterface {
  name = 'AddUserProfileFields1703123456789';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加个人信息字段
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'first_name',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
      new TableColumn({
        name: 'last_name',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
      new TableColumn({
        name: 'avatar',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'bio',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'birthday',
        type: 'date',
        isNullable: true,
      }),
      new TableColumn({
        name: 'gender',
        type: 'enum',
        enum: ['male', 'female', 'other'],
        isNullable: true,
      }),
    ]);

    // 添加索引以优化查询性能
    await queryRunner.createIndices('users', [
      new TableIndex({
        name: 'idx_users_first_name',
        columnNames: ['first_name'],
      }),
      new TableIndex({
        name: 'idx_users_last_name',
        columnNames: ['last_name'],
      }),
      new TableIndex({
        name: 'idx_users_gender',
        columnNames: ['gender'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除索引
    await queryRunner.dropIndex('users', 'idx_users_gender');
    await queryRunner.dropIndex('users', 'idx_users_last_name');
    await queryRunner.dropIndex('users', 'idx_users_first_name');

    // 删除字段
    await queryRunner.dropColumn('users', 'gender');
    await queryRunner.dropColumn('users', 'birthday');
    await queryRunner.dropColumn('users', 'bio');
    await queryRunner.dropColumn('users', 'avatar');
    await queryRunner.dropColumn('users', 'last_name');
    await queryRunner.dropColumn('users', 'first_name');
  }
}