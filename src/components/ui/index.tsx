import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-ink-200 bg-white shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("text-sm font-semibold tracking-tight text-ink-900", className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-xs text-ink-500", className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Page header                                                                 */
/* -------------------------------------------------------------------------- */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */
const badgeVariants: Record<string, string> = {
  neutral: "bg-ink-100 text-ink-700 border-ink-200",
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  success: "bg-brand-50 text-brand-700 border-brand-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  purple: "bg-violet-50 text-violet-700 border-violet-200",
};

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: ReactNode;
  variant?: keyof typeof badgeVariants | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        badgeVariants[variant] ?? badgeVariants.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Button / Link button                                                        */
/* -------------------------------------------------------------------------- */
const buttonVariants: Record<string, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 shadow-[0_1px_2px_rgba(16,24,20,0.08)]",
  secondary: "bg-white text-ink-800 border border-ink-200 hover:bg-ink-50",
  ghost: "bg-transparent text-ink-600 hover:bg-ink-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const buttonSizes: Record<string, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-sm",
};

export function buttonClass(
  variant: keyof typeof buttonVariants | string = "primary",
  size: keyof typeof buttonSizes | string = "md",
  className?: string
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed",
    buttonVariants[variant] ?? buttonVariants.primary,
    buttonSizes[size] ?? buttonSizes.md,
    className
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: string; size?: string }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: { href: string; variant?: string; size?: string; className?: string; children: ReactNode } & Omit<
  ComponentProps<typeof Link>,
  "href" | "className" | "children"
>) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Forms                                                                       */
/* -------------------------------------------------------------------------- */
export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1 block text-xs font-medium text-ink-600", className)} {...props} />;
}

const fieldClass =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-ink-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "min-h-[80px]", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(fieldClass, "appearance-none bg-[right_0.6rem_center] pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                       */
/* -------------------------------------------------------------------------- */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-ink-200 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500",
        className
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-ink-100 px-4 py-2.5 text-ink-700", className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("hover:bg-ink-50/60", className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* States                                                                      */
/* -------------------------------------------------------------------------- */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-white/70 px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-400">{icon}</div>}
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-md text-xs text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
      <span className="font-medium">Something went wrong.</span> {message}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* KPI stat                                                                    */
/* -------------------------------------------------------------------------- */
const statAccent: Record<string, string> = {
  neutral: "bg-ink-200",
  brand: "bg-brand-500",
  warning: "bg-amber-400",
  danger: "bg-red-500",
};

export function Stat({
  label,
  value,
  unit,
  hint,
  delta,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  delta?: { value: string; tone: "up" | "down" | "flat" };
  tone?: "neutral" | "brand" | "warning" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "text-ink-900",
    brand: "text-brand-700",
    warning: "text-amber-600",
    danger: "text-red-600",
  };
  return (
    <Card className={cn("relative flex flex-col overflow-hidden p-4", className)}>
      {/* Tone accent so the KPI grid reads as distinct cards instead of a flat
          white field. */}
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px]", statAccent[tone])} />
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={cn("text-2xl font-semibold tabular-nums tracking-tight", tones[tone])}>{value}</span>
        {unit && <span className="text-xs text-ink-400">{unit}</span>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {delta && (
          <span
            className={cn(
              "text-[11px] font-medium",
              delta.tone === "up" ? "text-red-600" : delta.tone === "down" ? "text-brand-700" : "text-ink-400"
            )}
          >
            {delta.value}
          </span>
        )}
        {hint && <span className="text-[11px] leading-tight text-ink-400">{hint}</span>}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */
export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "warning" | "danger" }) {
  const tones = { brand: "bg-brand-500", warning: "bg-amber-500", danger: "bg-red-500" };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
      <div className={cn("h-full rounded-full", tones[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Definition({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 py-2 last:border-0">
      <span className="text-xs text-ink-500">{term}</span>
      <span className="text-right text-xs font-medium text-ink-800">{children}</span>
    </div>
  );
}
