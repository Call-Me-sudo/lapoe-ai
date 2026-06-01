import { ReactNode } from "react";
import { ChevronRight, LucideIcon } from "lucide-react";
import IconTile, { TileTone } from "./IconTile";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  tone?: TileTone;
  title: string;
  description?: string;
  right?: ReactNode;
  onClick?: () => void;
  href?: string;
  as?: "button" | "div";
  className?: string;
  showChevron?: boolean;
};

export default function ActionRow({
  icon,
  tone = "blue",
  title,
  description,
  right,
  onClick,
  className,
  showChevron = false,
}: Props) {
  const interactive = !!onClick;
  const Wrapper: any = interactive ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-5 py-4 text-left transition-colors",
        interactive && "hover:bg-muted/60 active:bg-muted",
        className,
      )}
    >
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-foreground truncate">{title}</div>
        {description && <div className="text-sm text-muted-foreground truncate">{description}</div>}
      </div>
      {right ?? (showChevron && <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
    </Wrapper>
  );
}
