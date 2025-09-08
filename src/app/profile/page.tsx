
import { UserProfile } from "@/components/auth/UserProfile";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function ProfilePage() {
  return (
    <ProtectedRoute roles={['provider', 'admin']}>
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <UserProfile />
      </main>
    </ProtectedRoute>
  );
}
