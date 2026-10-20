import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }

export function Button({ variant = 'secondary', className = '', children, ...props }: PropsWithChildren<ButtonProps>): React.JSX.Element {
  return <button className={`button button-${variant} ${className}`.trim()} {...props}>{children}</button>
}

export function Field({ label, help, error, children }: PropsWithChildren<{ label: string; help?: string; error?: string }>): React.JSX.Element {
  const errorId = error ? `${label.toLowerCase().replace(/\W+/g, '-')}-error` : undefined
  return <label className={`form-field${error ? ' has-error' : ''}`}>
    <span>{label}</span>
    {children}
    {help && <small>{help}</small>}
    {error && <small id={errorId} className="field-error" role="alert">{error}</small>}
  </label>
}

export function Dialog({ title, children, className = '' }: PropsWithChildren<{ title: string; className?: string }>): React.JSX.Element {
  return <div className="dialog-scrim">
    <section className={`dialog ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="dialog-title"><strong>{title}</strong></header>
      {children}
    </section>
  </div>
}
