import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  validatePassword,
  REQUIREMENT_MESSAGES,
  type PasswordRequirements,
} from '@/lib/password-validation';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
  className?: string;
}

export function PasswordStrengthIndicator({
  password,
  showRequirements = true,
  className,
}: PasswordStrengthIndicatorProps) {
  const validation = useMemo(() => validatePassword(password), [password]);

  if (!password) {
    return null;
  }

  const strengthConfig = {
    weak: {
      label: 'Fraca',
      color: 'bg-red-500',
      textColor: 'text-red-500',
    },
    medium: {
      label: 'Média',
      color: 'bg-yellow-500',
      textColor: 'text-yellow-500',
    },
    strong: {
      label: 'Forte',
      color: 'bg-green-500',
      textColor: 'text-green-500',
    },
  };

  const config = strengthConfig[validation.strength];
  const percentage = (validation.score / 5) * 100;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Força da senha</span>
          <span className={cn('font-medium', config.textColor)}>
            {config.label}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300 ease-out', config.color)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Requirements List */}
      {showRequirements && (
        <ul className="space-y-1.5">
          {(Object.entries(validation.requirements) as [keyof PasswordRequirements, boolean][]).map(
            ([key, met]) => (
              <li
                key={key}
                className={cn(
                  'flex items-center gap-2 text-xs transition-colors duration-200',
                  met ? 'text-green-500' : 'text-muted-foreground'
                )}
              >
                {met ? (
                  <Check className="h-3.5 w-3.5 flex-shrink-0" />
                ) : (
                  <X className="h-3.5 w-3.5 flex-shrink-0" />
                )}
                <span>{REQUIREMENT_MESSAGES[key]}</span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
