import { User, UserStatus } from './user.entity';

describe('User Entity', () => {
  let user: User;

  beforeEach(() => {
    user = new User();
    user.id = 'test-user-id';
    user.email = 'test@example.com';
    user.passwordHash = 'hashed-password';
    user.status = UserStatus.ACTIVE;
    user.failedLoginAttempts = 0;
    user.emailVerified = true;
    user.phoneVerified = false;
    user.mfaEnabled = false;
    user.createdAt = new Date();
    user.updatedAt = new Date();
  });

  describe('isLocked', () => {
    it('should return false for active user without lock time', () => {
      expect(user.isLocked()).toBe(false);
    });

    it('should return true when status is LOCKED', () => {
      user.status = UserStatus.LOCKED;
      expect(user.isLocked()).toBe(true);
    });

    it('should return true when lockedUntil is in future', () => {
      user.lockedUntil = new Date(Date.now() + 10000);
      expect(user.isLocked()).toBe(true);
    });
  });

  describe('isActive', () => {
    it('should return true for active unlocked user', () => {
      expect(user.isActive()).toBe(true);
    });

    it('should return false for locked user', () => {
      user.status = UserStatus.LOCKED;
      expect(user.isActive()).toBe(false);
    });
  });

  describe('incrementFailedAttempts', () => {
    it('should increment failed login attempts', () => {
      const initialAttempts = user.failedLoginAttempts;
      user.incrementFailedAttempts();
      expect(user.failedLoginAttempts).toBe(initialAttempts + 1);
    });

    it('should set lockedUntil when reaching 5 failed attempts', () => {
      user.failedLoginAttempts = 4;
      user.incrementFailedAttempts();
      
      expect(user.failedLoginAttempts).toBe(5);
      expect(user.lockedUntil).toBeDefined();
    });
  });

  describe('resetFailedAttempts', () => {
    it('should reset failed attempts to 0', () => {
      user.failedLoginAttempts = 3;
      user.resetFailedAttempts();
      expect(user.failedLoginAttempts).toBe(0);
    });

    it('should set lastLoginAt to current time', () => {
      const beforeReset = new Date();
      user.resetFailedAttempts();
      
      expect(user.lastLoginAt).toBeDefined();
      expect(user.lastLoginAt.getTime()).toBeGreaterThanOrEqual(beforeReset.getTime());
    });
  });
});