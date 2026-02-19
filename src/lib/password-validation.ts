export interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export interface PasswordValidationResult {
  requirements: PasswordRequirements;
  strength: PasswordStrength;
  isValid: boolean;
  score: number;
}

const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export function validatePassword(password: string): PasswordValidationResult {
  const requirements: PasswordRequirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: SPECIAL_CHARS_REGEX.test(password),
  };

  const score = Object.values(requirements).filter(Boolean).length;

  let strength: PasswordStrength;
  if (score <= 2) {
    strength = 'weak';
  } else if (score <= 4) {
    strength = 'medium';
  } else {
    strength = 'strong';
  }

  const isValid = Object.values(requirements).every(Boolean);

  return {
    requirements,
    strength,
    isValid,
    score,
  };
}

export const REQUIREMENT_MESSAGES: Record<keyof PasswordRequirements, string> = {
  minLength: 'Mínimo 8 caracteres',
  hasUppercase: 'Uma letra maiúscula (A-Z)',
  hasLowercase: 'Uma letra minúscula (a-z)',
  hasNumber: 'Um número (0-9)',
  hasSpecial: 'Um caractere especial (!@#$%...)',
};
