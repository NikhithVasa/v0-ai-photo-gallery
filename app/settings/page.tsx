import { AccountSettingsPage } from "@/components/account-settings-page";
import { ProtectedRoute } from "@/components/protected-route";

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <AccountSettingsPage />
    </ProtectedRoute>
  );
}
