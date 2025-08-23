import { MfaDevice, MfaDeviceType, MfaDeviceStatus } from './mfa-device.entity';

describe('MfaDevice Entity', () => {
  let mfaDevice: MfaDevice;

  beforeEach(() => {
    mfaDevice = new MfaDevice();
    mfaDevice.id = 'test-mfa-device-id';
    mfaDevice.userId = 'test-user-id';
    mfaDevice.type = MfaDeviceType.TOTP;
    mfaDevice.status = MfaDeviceStatus.ACTIVE;
    mfaDevice.name = '测试设备';
    mfaDevice.secret = 'encrypted-secret';
    mfaDevice.usageCount = 0;
    mfaDevice.createdAt = new Date();
    mfaDevice.updatedAt = new Date();
  });

  describe('isActive', () => {
    it('should return true for active device', () => {
      mfaDevice.status = MfaDeviceStatus.ACTIVE;
      expect(mfaDevice.isActive()).toBe(true);
    });

    it('should return false for pending device', () => {
      mfaDevice.status = MfaDeviceStatus.PENDING;
      expect(mfaDevice.isActive()).toBe(false);
    });

    it('should return false for disabled device', () => {
      mfaDevice.status = MfaDeviceStatus.DISABLED;
      expect(mfaDevice.isActive()).toBe(false);
    });
  });

  describe('activate', () => {
    it('should set status to active', () => {
      mfaDevice.status = MfaDeviceStatus.PENDING;
      mfaDevice.activate();
      expect(mfaDevice.status).toBe(MfaDeviceStatus.ACTIVE);
    });
  });

  describe('disable', () => {
    it('should set status to disabled', () => {
      mfaDevice.status = MfaDeviceStatus.ACTIVE;
      mfaDevice.disable();
      expect(mfaDevice.status).toBe(MfaDeviceStatus.DISABLED);
    });
  });

  describe('recordUsage', () => {
    it('should increment usage count and update last used time', () => {
      const initialCount = mfaDevice.usageCount;
      const beforeTime = new Date();
      
      mfaDevice.recordUsage();
      
      expect(mfaDevice.usageCount).toBe(initialCount + 1);
      expect(mfaDevice.lastUsedAt).toBeInstanceOf(Date);
      expect(mfaDevice.lastUsedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });
  });

  describe('backup codes', () => {
    it('should return empty array when no backup codes', () => {
      mfaDevice.backupCodes = null;
      expect(mfaDevice.getBackupCodes()).toEqual([]);
    });

    it('should parse backup codes from JSON', () => {
      const codes = ['ABC123', 'DEF456', 'GHI789'];
      mfaDevice.setBackupCodes(codes);
      expect(mfaDevice.getBackupCodes()).toEqual(codes);
    });

    it('should handle invalid JSON in backup codes', () => {
      mfaDevice.backupCodes = 'invalid-json';
      expect(mfaDevice.getBackupCodes()).toEqual([]);
    });

    it('should use backup code successfully', () => {
      const codes = ['ABC123', 'DEF456', 'GHI789'];
      mfaDevice.setBackupCodes(codes);
      
      const result = mfaDevice.useBackupCode('DEF456');
      
      expect(result).toBe(true);
      expect(mfaDevice.getBackupCodes()).toEqual(['ABC123', 'GHI789']);
      expect(mfaDevice.usageCount).toBe(1);
      expect(mfaDevice.lastUsedAt).toBeInstanceOf(Date);
    });

    it('should fail to use invalid backup code', () => {
      const codes = ['ABC123', 'DEF456', 'GHI789'];
      mfaDevice.setBackupCodes(codes);
      
      const result = mfaDevice.useBackupCode('INVALID');
      
      expect(result).toBe(false);
      expect(mfaDevice.getBackupCodes()).toEqual(codes);
      expect(mfaDevice.usageCount).toBe(0);
    });
  });

  describe('MfaDeviceType Enum', () => {
    it('should have correct enum values', () => {
      expect(MfaDeviceType.TOTP).toBe('totp');
      expect(MfaDeviceType.SMS).toBe('sms');
      expect(MfaDeviceType.EMAIL).toBe('email');
      expect(MfaDeviceType.BACKUP_CODES).toBe('backup_codes');
    });
  });

  describe('MfaDeviceStatus Enum', () => {
    it('should have correct enum values', () => {
      expect(MfaDeviceStatus.PENDING).toBe('pending');
      expect(MfaDeviceStatus.ACTIVE).toBe('active');
      expect(MfaDeviceStatus.DISABLED).toBe('disabled');
    });
  });
});