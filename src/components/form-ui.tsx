"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Modal                                                                       */
/* -------------------------------------------------------------------------- */
export function Modal({
  trigger,
  title,
  description,
  children,
  wide = false,
  variant = "primary",
  size = "md",
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  variant?: string;
  size?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClass(variant, size)} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "ww-enter relative my-8 w-full rounded-2xl border border-ink-200 bg-white shadow-xl",
              wide ? "max-w-3xl" : "max-w-lg"
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
                {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4" onSubmitCapture={() => setTimeout(() => setOpen(false), 50)}>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Submit button (shows pending state from the surrounding form)               */
/* -------------------------------------------------------------------------- */
export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingLabel,
}: {
  children: ReactNode;
  variant?: string;
  size?: string;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, size, className)}>
      {pending ? pendingLabel ?? "Saving…" : children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Confirm-on-submit button for destructive actions                            */
/* -------------------------------------------------------------------------- */
export function ConfirmButton({
  children,
  message,
  variant = "danger",
  size = "sm",
  className,
}: {
  children: ReactNode;
  message: string;
  variant?: string;
  size?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={buttonClass(variant, size, className)}
    >
      {pending ? "…" : children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Flash message (reads ?error= / ?ok= style props passed from the page)      */
/* -------------------------------------------------------------------------- */
export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <div
      className={cn(
        "mb-5 rounded-xl border px-4 py-3 text-xs",
        error ? "border-red-200 bg-red-50 text-red-700" : "border-brand-200 bg-brand-50 text-brand-800"
      )}
    >
      {error ?? ok}
    </div>
  );
}
