import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import UsersList from "@/pages/UsersList";
import UserProfile from "@/pages/UserProfile";
import InviteAdmin from "@/pages/InviteAdmin";
import EmergencyContacts from "@/pages/EmergencyContacts";
import CheckInMonitoring from "@/pages/CheckInMonitoring";
import Sensors from "@/pages/Sensors";
import Settings from "@/pages/Settings";
import MedicationAdherence from "@/pages/MedicationAdherence";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Dashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <UsersList />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <UserProfile />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/:id/medications"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <MedicationAdherence />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/emergency-contacts"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <EmergencyContacts />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkin-monitoring"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CheckInMonitoring />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sensors"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Sensors />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/invite"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <InviteAdmin />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Settings />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
