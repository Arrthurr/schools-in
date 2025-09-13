import * as React from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "error" | "warning" | "info";
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
  showIcon?: boolean;
  duration?: number;
}

function Toast({
  variant = "default",
  title,
  description,
  action,
  onClose,
  showIcon = true,
  duration = 5000,
  className,
  children,
  ...props
}: ToastProps) {
  const [isVisible, setIsVisible] = React.useState(true);
  const [isClosing, setIsClosing] = React.useState(false);

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300); // Animation duration
  };

  const getIcon = () => {
    switch (variant) {
      case "success":
        return <CheckCircle className="h-5 w-5" />;
      case "error":
        return <AlertCircle className="h-5 w-5" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5" />;
      case "info":
        return <Info className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return "bg-green-50 border-green-200 text-green-800";
      case "error":
        return "bg-red-50 border-red-200 text-red-800";
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "info":
        return "bg-blue-50 border-blue-200 text-blue-800";
      default:
        return "bg-white border-gray-200 text-gray-800";
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case "success":
        return "text-green-600";
      case "error":
        return "text-red-600";
      case "warning":
        return "text-yellow-600";
      case "info":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "relative flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-300",
        "animate-slideInRight",
        isClosing && "animate-fadeOut opacity-0 translate-x-full",
        getVariantStyles(),
        className
      )}
      {...props}
    >
      {showIcon && getIcon() && (
        <div className={cn("flex-shrink-0 mt-0.5", getIconColor())}>
          {getIcon()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {title && (
          <div className="font-medium text-sm leading-5 mb-1">{title}</div>
        )}
        {description && (
          <div className="text-sm opacity-90 leading-5">{description}</div>
        )}
        {children}

        {action && (
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={action.onClick}
              className="text-xs h-8"
            >
              {action.label}
            </Button>
          </div>
        )}
      </div>

      {onClose && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleClose}
          className="flex-shrink-0 h-6 w-6 p-0 hover:bg-black/10 rounded-full"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      )}
    </div>
  );
}

interface ToastContainerProps {
  position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center";
  children: React.ReactNode;
}

function ToastContainer({
  position = "top-right",
  children,
}: ToastContainerProps) {
  const getPositionStyles = () => {
    switch (position) {
      case "top-left":
        return "top-4 left-4";
      case "top-center":
        return "top-4 left-1/2 transform -translate-x-1/2";
      case "top-right":
        return "top-4 right-4";
      case "bottom-left":
        return "bottom-4 left-4";
      case "bottom-center":
        return "bottom-4 left-1/2 transform -translate-x-1/2";
      case "bottom-right":
        return "bottom-4 right-4";
      default:
        return "top-4 right-4";
    }
  };

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col gap-2 w-full max-w-sm",
        getPositionStyles()
      )}
    >
      {children}
    </div>
  );
}

// Hook for managing toasts
interface ToastData {
  id: string;
  variant?: ToastProps["variant"];
  title?: string;
  description?: string;
  action?: ToastProps["action"];
  duration?: number;
}

function useToast() {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastData, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = React.useCallback(
    (toast: Omit<ToastData, "id">) => {
      addToast(toast);
    },
    [addToast]
  );

  const success = React.useCallback(
    (title: string, description?: string) => {
      toast({ variant: "success", title, description });
    },
    [toast]
  );

  const error = React.useCallback(
    (title: string, description?: string) => {
      toast({ variant: "error", title, description });
    },
    [toast]
  );

  const warning = React.useCallback(
    (title: string, description?: string) => {
      toast({ variant: "warning", title, description });
    },
    [toast]
  );

  const info = React.useCallback(
    (title: string, description?: string) => {
      toast({ variant: "info", title, description });
    },
    [toast]
  );

  return {
    toasts,
    toast,
    success,
    error,
    warning,
    info,
    removeToast,
  };
}

export { Toast, ToastContainer, useToast };
