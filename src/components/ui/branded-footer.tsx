import { Logo } from "./logo";
import Link from "next/link";

interface BrandedFooterProps {
  variant?: "simple" | "detailed";
  showLogo?: boolean;
  className?: string;
}

export function BrandedFooter({
  variant = "simple",
  showLogo = true,
  className = "",
}: BrandedFooterProps) {
  const currentYear = new Date().getFullYear();

  if (variant === "simple") {
    return (
      <footer className={`py-6 px-4 border-t bg-gray-50/50 ${className}`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {showLogo && <Logo size="sm" />}
            <div className="text-sm text-muted-foreground text-center sm:text-right">
              <p>© {currentYear} DMDL Schools-In. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  // detailed variant
  return (
    <footer className={`py-12 px-4 border-t bg-gray-50 ${className}`}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            {showLogo && <Logo size="md" />}
            <p className="text-sm text-muted-foreground max-w-md">
              Professional location-based check-in system for education service
              providers. Ensuring accountability and safety in school
              environments.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Quick Links</h3>
            <div className="space-y-2 text-sm">
              <Link
                href="/dashboard"
                className="block text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/profile"
                className="block text-muted-foreground hover:text-foreground transition-colors"
              >
                Profile
              </Link>
              <Link
                href="/dashboard"
                className="block text-muted-foreground hover:text-foreground transition-colors"
              >
                Session History
              </Link>
            </div>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Support</h3>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Need help? Contact your administrator or technical support.
              </p>
              <p className="text-muted-foreground">System Version: 1.0.0</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {currentYear} DMDL Schools-In. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Built with security and reliability in mind.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
