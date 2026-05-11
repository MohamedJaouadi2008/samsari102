import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Size = "xs" | "sm" | "md" | "lg";

interface VerifiedBadgeProps {
  size?: Size;
  showLabel?: boolean;
  className?: string;
  tooltip?: string;
}

const sizeMap: Record<Size, { icon: string; text: string; pad: string }> = {
  xs: { icon: "h-3 w-3", text: "text-[10px]", pad: "px-1.5 py-0.5 gap-1" },
  sm: { icon: "h-3.5 w-3.5", text: "text-xs", pad: "px-2 py-0.5 gap-1" },
  md: { icon: "h-4 w-4", text: "text-sm", pad: "px-2.5 py-1 gap-1.5" },
  lg: { icon: "h-5 w-5", text: "text-base", pad: "px-3 py-1.5 gap-2" },
};

const VerifiedBadge = ({
  size = "sm",
  showLabel = true,
  className,
  tooltip = "Identity verified by Samsari",
}: VerifiedBadgeProps) => {
  const s = sizeMap[size];
  const content = (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-emerald-300/60 bg-emerald-50 text-emerald-700 font-medium dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
        s.pad,
        s.text,
        className
      )}
    >
      <ShieldCheck className={s.icon} />
      {showLabel && <span>Verified</span>}
    </span>
  );

  if (!tooltip) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
};

export default VerifiedBadge;
