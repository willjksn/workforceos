import Link from "next/link";

import {
  buttonGhostOnNavyClass,
  buttonInverseClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
} from "@/components/ui-classes";

export {
  buttonGhostOnNavyClass,
  buttonInverseClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  fieldClass,
} from "@/components/ui-classes";

export function Section({
  children,
  tone = "light",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "light" | "navy" | "teal" | "white";
  className?: string;
}) {
  const tones = {
    light: "bg-background text-foreground",
    navy: "bg-navy text-white",
    teal: "bg-teal text-white",
    white: "bg-white text-foreground",
  };
  return <section className={`${tones[tone]} ${className}`}>{children}</section>;
}

export function Container({
  children,
  className = "",
  size = "default",
  pad = "default",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "default" | "narrow" | "wide";
  pad?: "default" | "compact" | "none";
}) {
  const widths = {
    default: "max-w-6xl",
    narrow: "max-w-3xl",
    wide: "max-w-7xl",
  };
  const pads = {
    default: "px-6 py-16 md:py-24",
    compact: "px-6 py-10 md:py-14",
    none: "px-6",
  };
  return <div className={`mx-auto ${widths[size]} ${pads[pad]} ${className}`}>{children}</div>;
}

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[11px] font-medium uppercase tracking-[0.18em] text-teal ${className}`}>{children}</div>
  );
}

export function Heading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`mt-3 font-serif text-3xl font-semibold tracking-tight text-navy md:text-4xl ${className}`}>{children}</h2>;
}

export function PageHero({
  eyebrow,
  title,
  children,
  size = "default",
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  size?: "default" | "narrow";
}) {
  return (
    <Section tone="navy">
      <Container size={size}>
        <Eyebrow className="text-[#9fc0cb]">{eyebrow}</Eyebrow>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-white md:text-5xl">{title}</h1>
        {children}
      </Container>
    </Section>
  );
}

export function HorizonRule({ className = "" }: { className?: string }) {
  return <div className={`horizon ${className}`} aria-hidden="true" />;
}

export function CtaLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "inverse" | "ghostOnNavy";
}) {
  const className =
    variant === "primary"
      ? buttonPrimaryClass
      : variant === "inverse"
        ? buttonInverseClass
        : variant === "ghostOnNavy"
          ? buttonGhostOnNavyClass
          : buttonSecondaryClass;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
