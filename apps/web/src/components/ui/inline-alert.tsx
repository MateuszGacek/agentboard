import { AlertCircle } from "lucide-react";

import { cn } from "../../lib/utils";

type InlineAlertProps = {
  children: React.ReactNode;
  className?: string;
};

export function InlineAlert({ children, className }: InlineAlertProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm leading-6 text-foreground",
        className
      )}
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
