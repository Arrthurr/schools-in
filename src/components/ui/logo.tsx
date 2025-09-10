import * as React from "react";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "./optimized-image";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
  showText?: boolean;
}

const sizeMap = {
  sm: { width: 32, height: 32, textSize: "text-lg" },
  md: { width: 48, height: 48, textSize: "text-xl" },
  lg: { width: 64, height: 64, textSize: "text-2xl" },
  xl: { width: 96, height: 96, textSize: "text-3xl" },
};

export function Logo({
  size = "md",
  className,
  priority = false,
  showText = true,
}: LogoProps) {
  const { width, height, textSize } = sizeMap[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <OptimizedImage
        src="/DMDL_logo.png"
        alt="DMDL Schools-In Logo"
        width={width}
        height={height}
        priority={priority}
        quality={90}
        className="object-contain"
        loading={priority ? "eager" : "lazy"}
      />
      {showText && (
        <span className={cn("font-bold text-brand-primary", textSize)}>
          Schools-In
        </span>
      )}
    </div>
  );
}

// Brand header component for pages
export function BrandHeader({
  title,
  subtitle,
  className,
}: {
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("text-center space-y-4", className)}>
      <Logo size="xl" className="justify-center" />
      {title && (
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground text-sm sm:text-base">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
