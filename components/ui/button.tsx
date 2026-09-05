import Link from "next/link";

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "destructive";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white hover:bg-primary-hover",
  secondary: "border border-navy bg-surface text-navy hover:bg-surface-muted",
  ghost: "text-navy hover:bg-surface-muted",
  accent: "bg-teal text-white hover:opacity-90",
  destructive: "bg-danger text-white hover:opacity-90",
};

export function buttonClassName(variant: ButtonVariant = "primary", className = "") {
  return `inline-flex items-center justify-center rounded-[6px] px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${variants[variant]} ${className}`;
}

export function Button({
  children,
  variant = "primary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button className={buttonClassName(variant, className)} type={type} {...props}>
      {children}
    </button>
  );
}

export function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button className={buttonClassName("primary")} type="submit">
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
}) {
  return (
    <Link href={href} className={buttonClassName(variant)}>
      {children}
    </Link>
  );
}
