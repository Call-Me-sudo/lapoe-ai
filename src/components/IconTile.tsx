import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TileTone = "blue" | "green" | "pink" | "amber" | "violet" | "gray";

const tones: Record<TileTone, string> = {
  blue: "bg-tile-blue text-tile-blue-foreground",
  green: "bg-tile-green text-tile-green-foreground",
  pink: "bg-tile-pink text-tile-pink-foreground",
  amber: "bg-tile-amber text-tile-amber-foreground",
  violet: "bg-tile-violet text-tile-violet-foreground",
  gray: "bg-tile-gray text-tile-gray-foreground",
};

const sizes = {
  sm: "h-9 w-9 rounded-xl [&>svg]:h-4 [&>svg]:w-4",
  md: "h-11 w-11 rounded-2xl [&>svg]:h-5 [&>svg]:w-5",
  lg: "h-14 w-14 rounded-2xl [&>svg]:h-6 [&>svg]:w-6",
};

type Props = {
  icon: LucideIcon;
  tone?: TileTone;
  size?: keyof typeof sizes;
  rounded?: boolean; // full circle
  className?: string;
};

export default function IconTile({ icon: Icon, tone = "blue", size = "md", rounded, className }: Props) {
  return (
    <div className={cn("grid place-items-center shrink-0", sizes[size], tones[tone], rounded && "!rounded-full", className)}>
      <Icon />
    </div>
  );
}
