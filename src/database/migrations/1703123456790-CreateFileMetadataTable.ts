import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateFileMetadataTable1703123456790 implements MigrationInterface {
  name = 'CreateFileMetadataTable1703123456790';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建file_metadata表
    await queryRunner.createTable(
      new Table({
        name: 'file_metadata',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'file_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'original_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'file_path',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'file_size',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'mime_type',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'file_type',
            type: 'enum',
            enum: ['avatar', 'document', 'image', 'other'],
            default: "'other'",
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            name: 'fk_file_metadata_user',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // 创建索引
    await queryRunner.query(
      'CREATE INDEX idx_file_metadata_user_id_type ON file_metadata (user_id, file_type)'
    );
    await queryRunner.query(
      'CREATE INDEX idx_file_metadata_created_at ON file_metadata (created_at)'
    );
    await queryRunner.query(
      'CREATE INDEX idx_file_metadata_is_active ON file_metadata (is_active)'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除索引
    await queryRunner.query('DROP INDEX IF EXISTS idx_file_metadata_is_active');
    await queryRunner.query('DROP INDEX IF EXISTS idx_file_metadata_created_at');
    await queryRunner.query('DROP INDEX IF EXISTS idx_file_metadata_user_id_type');

    // 删除表
    await queryRunner.dropTable('file_metadata');
  }
}