const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;
const NAME_MIN_LENGTH = 1;
const AGE_MIN = 10;
const AGE_MAX = 120;
const CYCLE_LENGTH_MIN = 15;
const CYCLE_LENGTH_MAX = 60;

export function validateEmail(email) {
  if (!email || !email.trim()) return 'Email is required.';
  if (!EMAIL_REGEX.test(email.trim())) return 'Please enter a valid email address.';
  return null;
}

export function validatePassword(password) {
  if (!password) return 'Password is required.';
  if (password.length < PASSWORD_MIN_LENGTH) return 'Password must be at least 6 characters.';
  return null;
}

export function validateName(name) {
  if (!name || !name.trim()) return 'Name is required.';
  if (name.trim().length < NAME_MIN_LENGTH) return 'Name cannot be empty.';
  return null;
}

export function validateAge(age) {
  if (!age || !age.trim()) return 'Age is required.';
  const num = parseInt(age, 10);
  if (isNaN(num) || num < AGE_MIN || num > AGE_MAX) return 'Please enter a valid age (10-120).';
  return null;
}

export function validateCycleLength(length) {
  if (!length || !length.trim()) return 'Cycle length is required.';
  const num = parseInt(length, 10);
  if (isNaN(num) || num < CYCLE_LENGTH_MIN || num > CYCLE_LENGTH_MAX) {
    return 'Please enter a valid cycle length (21-45 days).';
  }
  return null;
}

export function validateDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return 'Date is required.';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return 'Date must use YYYY-MM-DD format.';
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (d.getFullYear() !== Number(match[1]) || d.getMonth() !== Number(match[2]) - 1 || d.getDate() !== Number(match[3])) {
    return 'Invalid date.';
  }
  if (d > new Date()) return 'Date cannot be in the future.';
  return null;
}

export function getPasswordStrength(pass) {
  if (!pass) return null;
  if (pass.length < PASSWORD_MIN_LENGTH) return 'Weak';
  const onlyDigits = /^\d+$/.test(pass);
  if (onlyDigits) return 'Weak';
  const hasUppercase = /[A-Z]/.test(pass);
  const hasLowercase = /[a-z]/.test(pass);
  const hasNumberOrSpecial = /[\d\W_]/.test(pass);
  if (pass.length >= 8 && hasUppercase && hasLowercase && hasNumberOrSpecial) return 'Strong';
  return 'Medium';
}
