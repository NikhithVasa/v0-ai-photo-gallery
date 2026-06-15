import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const AI_PRIVACY_MESSAGE =
  "AI runs on your local machine. Photos, prompts, and metadata are not used for training or any other activities.";

interface AiPrivacyNoticeProps {
  className?: string;
  iconClassName?: string;
}

export function AiPrivacyNotice({
  className,
  iconClassName,
}: AiPrivacyNoticeProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-2xl border border-zinc-200 bg-white/85 px-3 py-2 text-xs font-medium leading-5 text-zinc-600 shadow-sm backdrop-blur",
        className,
      )}
    >
      <ShieldCheck
        className={cn("mt-0.5 h-4 w-4 shrink-0 text-zinc-500", iconClassName)}
        strokeWidth={1.8}
      />
      <span>{AI_PRIVACY_MESSAGE}</span>
    </div>
  );
}
