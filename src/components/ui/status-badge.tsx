import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Pause,
  X,
  HelpCircle
} from "lucide-react";
import { getSessionStatusConfig } from "@/lib/utils/session";

interface StatusBadgeProps {
  status: string;
  showIcon?: boolean;
  showDescription?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showIcon = true,
  showDescription = false,
  size = "md",
  className = "",
}) => {
  const config = getSessionStatusConfig(status);

  const getIcon = (iconName: string) => {
    const iconProps = {
      className: size === "sm" ? "w-3 h-3" : size === "lg" ? "w-4 h-4" : "w-3 h-3"
    };

    switch (iconName) {
      case "Clock":
        return <Clock {...iconProps} />;
      case "CheckCircle":
        return <CheckCircle {...iconProps} />;
      case "AlertCircle":
        return <AlertCircle {...iconProps} />;
      case "Pause":
        return <Pause {...iconProps} />;
      case "X":
        return <X {...iconProps} />;
      default:
        return <HelpCircle {...iconProps} />;
    }
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-0.5",
    lg: "text-base px-3 py-1"
  };

  return (
    <Badge
      variant="outline"
      className={`${config.color} ${sizeClasses[size]} ${className}`}
      title={showDescription ? config.description : undefined}
    >
      {showIcon && (
        <span className="mr-1">
          {getIcon(config.icon)}
        </span>
      )}
      {config.label}
    </Badge>
  );
};
