import { Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Size = "xs" | "sm" | "md" | "lg";

interface SuperhostBadgeProps {
  size?: Size;
  showLabel?: boolean;
  className?: string;
}

const sizeMap: Record<Size, { icon: string; text: string; pad: string }> = {
  xs: { icon: "h-3 w-3", text: "text-[10px]", pad: "px-1.5 py-0.5 gap-1" },
  sm: { icon: "h-3.5 w-3.5", text: "text-xs", pad: "px-2 py-0.5 gap-1" },
  md: { icon: "h-4 w-4", text: "text-sm", pad: "px-2.5 py-1 gap-1.5" },
  lg: { icon: "h-5 w-5", text: "text-base", pad: "px-3 py-1.5 gap-2" },
};

export default function SuperhostBadge({ size = "sm", showLabel = true, className }: SuperhostBadgeProps) {
  const s = sizeMap[size];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center rounded-full border border-amber-300/70 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 font-semibold dark:from-amber-950/40 dark:to-yellow-950/40 dark:text-amber-300 dark:border-amber-800",
            s.pad,
            s.text,
            className
          )}
        >
          <Award className={s.icon} />
          {showLabel && <span>Superhost</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs max-w-xs">
          <strong>Superhosts</strong> are top-rated, experienced hosts on Samsari. They maintain a 4.8★+ rating and at least 10 completed stays.
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
