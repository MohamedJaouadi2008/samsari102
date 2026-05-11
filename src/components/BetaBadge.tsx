import { Construction } from "lucide-react";

const BetaBadge = () => {
  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 bg-amber-500/90 text-amber-950 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm text-xs sm:text-sm font-medium pointer-events-none select-none max-w-[60vw] sm:max-w-none">
      <Construction className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
      <span className="truncate">Under Construction – Coming Soon</span>
    </div>
  );
};

export default BetaBadge;
