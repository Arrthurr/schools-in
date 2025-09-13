import { Logo } from "./logo";
import { Skeleton } from "./skeleton";
import { Card, CardContent } from "./card";

interface BrandedLoadingProps {
  message?: string;
  showLogo?: boolean;
  variant?: "page" | "card" | "inline";
  className?: string;
}

export function BrandedLoading({
  message = "Loading...",
  showLogo = true,
  variant = "page",
  className = "",
}: BrandedLoadingProps) {
  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {showLogo && <Logo size="sm" showText={false} />}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">{message}</span>
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <Card className={className}>
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center space-y-4">
            {showLogo && <Logo size="lg" />}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-muted-foreground">{message}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // page variant
  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4 ${className}`}
    >
      <div className="text-center space-y-6">
        {showLogo && <Logo size="xl" className="justify-center" />}
        <div className="flex items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-lg text-muted-foreground">{message}</span>
        </div>
        <div className="space-y-2 max-w-sm">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mx-auto" />
        </div>
      </div>
    </div>
  );
}

// Branded loading skeleton for lists
export function BrandedListSkeleton({
  items = 3,
  showLogo = false,
  className = "",
}: {
  items?: number;
  showLogo?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {showLogo && (
        <div className="flex justify-center mb-6">
          <Logo size="md" />
        </div>
      )}
      {Array.from({ length: items }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
