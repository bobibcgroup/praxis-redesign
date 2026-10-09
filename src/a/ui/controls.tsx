/** Primitives built to the Hairline rules: 44 px controls, text centred by the box, label and hint on one baseline. */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({ className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={`a-control a-primary ${className}`} {...rest} />;
}

export function QuietButton({ className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={`a-control a-secondary ${className}`} {...rest} />;
}

export function TextButton({ className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={`a-control a-tertiary ${className}`} {...rest} />;
}

interface LinkButtonProps {
  to: string;
  variant?: "primary" | "secondary" | "tertiary";
  className?: string;
  children: ReactNode;
  replace?: boolean;
}

export function LinkButton({ to, variant = "secondary", className = "", children, replace }: LinkButtonProps) {
  return (
    <Link to={to} replace={replace} className={`a-control a-${variant} ${className}`}>
      {children}
    </Link>
  );
}

/** The premium marker inside a gated control. Gone once the user has Plus. */
export function PlusMark({ show }: { show: boolean }) {
  return show ? <span className="hint">Plus</span> : null;
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "numeric" | "email";
  autoComplete?: string;
}

export function Field({ id, label, value, onChange, placeholder, type = "text", inputMode, autoComplete }: FieldProps) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-[13px] leading-5 text-[var(--muted)]">{label}</span>
      <input id={id} type={type} inputMode={inputMode} autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="a-input" />
    </label>
  );
}

export function Caption({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[13px] leading-5 text-[var(--muted)] ${className}`}>{children}</p>;
}

interface ChoiceListProps<T extends string> {
  label: string;
  options: readonly { id: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (id: T) => void;
  /** Two columns for short labels when the list is long. */
  columns?: 1 | 2;
}

/** One question's answers: a radiogroup of full-width controls, stacked 8 px apart. */
export function ChoiceList<T extends string>({ label, options, value, onChange, columns = 1 }: ChoiceListProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={columns === 2 ? "a-answers grid grid-cols-2" : "a-answers"}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className="a-control">
          {o.label}
          {o.hint ? <span className="hint">{o.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}
