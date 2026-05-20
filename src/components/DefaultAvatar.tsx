import React from "react";
import { cn } from "@/lib/utils";

interface DefaultAvatarProps {
  src?: string | null;
  name?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  objectFit?: "cover" | "contain";
}

const getInitials = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

const getColour = (name?: string) => {
  const colours = ["#3B82F6","#8B5CF6","#10B981","#F59E0B","#EF4444","#EC4899","#06B6D4","#6366F1"];
  if (!name) return colours[0];
  const index = name.charCodeAt(0) % colours.length;
  return colours[index];
};

const DefaultAvatar: React.FC<DefaultAvatarProps> = ({
  src, name, className, size = "md", objectFit = "cover",
}) => {
  const sizeClasses = { sm: "w-7 h-7", md: "w-9 h-9", lg: "w-12 h-12", xl: "w-20 h-20" };
  const fontSizes = { sm: "text-[8px]", md: "text-[10px]", lg: "text-[13px]", xl: "text-xl" };
  const isDicebear = src?.includes("dicebear.com");
  const hasImage = src && !isDicebear;

  return (
    <div className={cn("relative rounded-xl overflow-hidden flex-shrink-0", sizeClasses[size], className)}>
      {hasImage ? (
        <img
          src={src}
          alt={name || "Avatar"}
          className={cn("w-full h-full", objectFit === "contain" ? "object-contain p-1 bg-white" : "object-cover")}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className={cn("w-full h-full flex items-center justify-center font-black", fontSizes[size])}
          style={{ backgroundColor: getColour(name), color: "#fff" }}
        >
          {getInitials(name)}
        </div>
      )}
    </div>
  );
};

export default DefaultAvatar;
