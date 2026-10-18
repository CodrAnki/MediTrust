const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterForm({ name, email, password, confirmPassword }) {
  const errors = {};

  if (!name?.trim()) {
    errors.name = 'Name is required.';
  }

  if (!email?.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export function validateLoginForm({ email, password }) {
  const errors = {};

  if (!email?.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  }

  return errors;
}
