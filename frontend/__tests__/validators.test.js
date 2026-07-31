import {
  validateEmail,
  validatePassword,
  validateName,
  validateAge,
  validateCycleLength,
  getPasswordStrength
} from '../utils/validators';

describe('Validators', () => {
  describe('validateEmail', () => {
    it('should return error for empty email', () => {
      expect(validateEmail('')).toBe('Email is required.');
    });
    it('should return error for invalid email', () => {
      expect(validateEmail('invalid-email')).toBe('Please enter a valid email address.');
    });
    it('should return null for valid email', () => {
      expect(validateEmail('test@example.com')).toBeNull();
    });
  });

  describe('validatePassword', () => {
    it('should return error for empty password', () => {
      expect(validatePassword('')).toBe('Password is required.');
    });
    it('should return error for short password', () => {
      expect(validatePassword('12345')).toBe('Password must be at least 6 characters.');
    });
    it('should return null for valid password', () => {
      expect(validatePassword('123456')).toBeNull();
    });
  });

  describe('getPasswordStrength', () => {
    it('should return Weak for short passwords', () => {
      expect(getPasswordStrength('123')).toBe('Weak');
    });
    it('should return Weak for numbers only', () => {
      expect(getPasswordStrength('12345678')).toBe('Weak');
    });
    it('should return Strong for complex passwords', () => {
      expect(getPasswordStrength('StrongPass1!')).toBe('Strong');
    });
  });
});
