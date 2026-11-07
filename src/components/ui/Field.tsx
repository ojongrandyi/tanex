import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';
import './ui.css';

// Form controls (BRAND_GUIDE §9): label above the field, 48 px touch height, hint and inline error
// (icon + text) wired to the control with aria-describedby / aria-invalid. Labels and messages are
// passed in by the caller (copy comes from CONTENT / the i18n dictionaries, never from here).

interface FieldShellProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Shown after the label, e.g. "(optional)"; the caller supplies the words. */
  optionalText?: React.ReactNode;
  required?: boolean;
  className?: string;
}

interface Wiring {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

function useWiring(idProp: string | undefined, hint: unknown, error: unknown): Wiring & { hintId: string; errorId: string } {
  const auto = useId();
  const id = idProp || `tx-f${auto.replace(/:/g, '')}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const ids = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ');
  return { id, hintId, errorId, describedBy: ids || undefined, invalid: Boolean(error) };
}

function Shell({ label, hint, error, optionalText, required, className = '', wiring, children }:
  FieldShellProps & { wiring: ReturnType<typeof useWiring>; children: React.ReactNode }) {
  return (
    <div className={`tx-field${error ? ' tx-field--error' : ''}${className ? ` ${className}` : ''}`}>
      <label className="tx-label" htmlFor={wiring.id}>
        {label}
        {required && <span className="tx-label__required" aria-hidden="true">*</span>}
        {optionalText && <span className="tx-label__optional"> {optionalText}</span>}
      </label>
      {children}
      {hint && <p className="tx-hint" id={wiring.hintId}>{hint}</p>}
      {error && (
        <p className="tx-error" id={wiring.errorId}>
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export type InputProps = FieldShellProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> & { inputClassName?: string };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, optionalText, required, className, inputClassName = '', id, ...rest }, ref) {
  const w = useWiring(id, hint, error);
  return (
    <Shell label={label} hint={hint} error={error} optionalText={optionalText} required={required} className={className} wiring={w}>
      <input ref={ref} id={w.id} className={`tx-input ${inputClassName}`.trim()} required={required}
        aria-invalid={w.invalid || undefined} aria-describedby={w.describedBy} {...rest} />
    </Shell>
  );
});

export type TextareaProps = FieldShellProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, optionalText, required, className, id, ...rest }, ref) {
  const w = useWiring(id, hint, error);
  return (
    <Shell label={label} hint={hint} error={error} optionalText={optionalText} required={required} className={className} wiring={w}>
      <textarea ref={ref} id={w.id} className="tx-input" required={required}
        aria-invalid={w.invalid || undefined} aria-describedby={w.describedBy} {...rest} />
    </Shell>
  );
});

export type SelectProps = FieldShellProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, optionalText, required, className, id, children, ...rest }, ref) {
  const w = useWiring(id, hint, error);
  return (
    <Shell label={label} hint={hint} error={error} optionalText={optionalText} required={required} className={className} wiring={w}>
      <select ref={ref} id={w.id} className="tx-input" required={required}
        aria-invalid={w.invalid || undefined} aria-describedby={w.describedBy} {...rest}>
        {children}
      </select>
    </Shell>
  );
});

type ChoiceProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  label: React.ReactNode;
  error?: boolean;
  className?: string;
};

function Choice({ type, label, error, className = '', ...rest }: ChoiceProps & { type: 'checkbox' | 'radio' }) {
  return (
    <label className={`tx-check${error ? ' tx-check--error' : ''}${className ? ` ${className}` : ''}`}>
      <input type={type} aria-invalid={error || undefined} {...rest} />
      <span>{label}</span>
    </label>
  );
}

/** Checkbox with its label; wrap a group in <fieldset><legend> for the question. */
export const Checkbox: React.FC<ChoiceProps> = (props) => <Choice type="checkbox" {...props} />;
/** Radio with its label; give every radio in a group the same `name`. */
export const Radio: React.FC<ChoiceProps> = (props) => <Choice type="radio" {...props} />;
