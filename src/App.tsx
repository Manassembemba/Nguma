import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { Loader2 } from "lucide-react";
import { isRecoveryFlow, clearNavigationState } from "@/services/navigationService";
import { useNavigationState } from "@/hooks/useNavigationState";
import { getMaintenanceMode } from "@/services/maintenanceService";
import { supabase } from "@/integrations/supabase/client";
import { getProfile } from "@/services/profileService";

// Lazy load pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Terms = lazy(() => import("./pages/Terms"));
const HowItWorksPage = lazy(() => import("./pages/HowItWorks"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ContractsPage = lazy(() => import("./pages/Contracts"));
const TransactionsPage = lazy(() => import("./pages/Transactions"));
const NotFound = lazy(() => import("./pages/NotFound"));
import ProtectedRoute from "./components/ProtectedRoute";
import { NotificationProvider } from "./contexts/NotificationContext";
import AdminRoute from "./components/AdminRoute";
const AdminPage = lazy(() => import("./pages/Admin"));
const UsersPage = lazy(() => import("./pages/admin/UsersPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const PendingDepositsPage = lazy(() => import("./pages/admin/PendingDepositsPage"));
const PendingWithdrawalsPage = lazy(() => import("./pages/admin/PendingWithdrawalsPage"));

const AdminContractsPage = lazy(() => import("./pages/admin/Contracts"));
const AdminUserContractsPage = lazy(() => import("./pages/admin/AdminUserContractsPage"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const Logout = lazy(() => import("./pages/Logout"));
import { ProfileCompletionGuard } from "./components/ProfileCompletionGuard";
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const Setup2FA = lazy(() => import("./pages/Setup2FA"));
const LoginAuditPage = lazy(() => import("./pages/admin/LoginAuditPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const AdminSupportPage = lazy(() => import("./pages/admin/AdminSupportPage"));
const AdminTransactionsPage = lazy(() => import("./pages/admin/AdminTransactionsPage"));
const AdminEmailBroadcast = lazy(() => import("./pages/admin/AdminEmailBroadcast").then(module => ({ default: module.AdminEmailBroadcast })));
const AccountingPage = lazy(() => import("./pages/admin/accounting/AccountingPage"));
const PaymentSchedulerPage = lazy(() => import("./pages/admin/accounting/PaymentSchedulerPage"));
const LedgerPage = lazy(() => import("./pages/admin/accounting/LedgerPage"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings").then(module => ({ default: module.NotificationSettings }))); // Corrected import
const MaintenancePage = lazy(() => import("./pages/Maintenance").then(module => ({ default: module.MaintenancePage }))); // Import MaintenancePage
import { ChatButton } from "./components/ChatButton";
import InstallPWA from "./components/InstallPWA";
import { MobileBottomNav } from "./components/MobileBottomNav";

const queryClient = new QueryClient();

// MaintenanceGuard component to protect routes
const MaintenanceGuard = ({ children }: { children: React.ReactNode }) => {
  const { data: isMaintenance, isLoading: maintenanceLoading } = useQuery({
    queryKey: ['maintenance_mode'],
    queryFn: getMaintenanceMode,
    staleTime: 1000 * 60, // 1 minute
  });

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    enabled: !!isMaintenance,
    staleTime: 1000 * 60 * 5,
  });

  const isAdmin = profile?.user_roles?.some((r: any) => r.role === 'admin') || false;

  if (maintenanceLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-[#0b141a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#00a884]" />
      </div>
    );
  }

  if (isMaintenance && !isAdmin) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
};

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>
    <ProfileCompletionGuard>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 pb-16 md:pb-0">
          <AppHeader />
          <main className="flex-1">{children}</main>
        </div>
        <ChatButton />
        <MobileBottomNav />
      </div>
    </ProfileCompletionGuard>
  </SidebarProvider>
);

const AppInitializer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasInitializedRef = React.useRef(false);
  const { clearState } = useNavigationState();

  React.useEffect(() => {
    if (hasInitializedRef.current) return;
    clearState();
    hasInitializedRef.current = true;
  }, [clearState]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppInitializer />
        <InstallPWA />
        <NotificationProvider>
          <Suspense fallback={
            <div className="flex items-center justify-center h-screen w-full bg-[#0b141a]">
              <Loader2 className="h-8 w-8 animate-spin text-[#00a884]" />
            </div>
          }>
            <MaintenanceGuard>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/setup-2fa" element={<ProtectedRoute><Setup2FA /></ProtectedRoute>} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Dashboard />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/contracts"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <ContractsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transactions"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <TransactionsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <ProfilePage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/notifications"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <NotificationSettings />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AdminPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <UsersPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <SettingsPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/deposits"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <PendingDepositsPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/withdrawals"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <PendingWithdrawalsPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/contracts"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AdminContractsPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/user-contracts"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AdminUserContractsPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/login-audit"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <LoginAuditPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/support"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AdminSupportPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/transactions"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AdminTransactionsPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/broadcast"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AdminEmailBroadcast />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/accounting"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <AccountingPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/accounting/scheduler"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <PaymentSchedulerPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/accounting/ledger"
                  element={
                    <AdminRoute>
                      <AppLayout>
                        <LedgerPage />
                      </AppLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/support"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <SupportPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route path="/logout" element={<Logout />} />
                <Route path="/update-password" element={<UpdatePassword />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MaintenanceGuard>
          </Suspense>
        </NotificationProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
