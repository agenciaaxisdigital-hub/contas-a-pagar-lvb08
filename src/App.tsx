import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import NovaContaPage from "./pages/NovaContaPage";
import ContaDetalhePage from "./pages/ContaDetalhePage";
import RelatoriosPage from "./pages/RelatoriosPage";
import PerfilPage from "./pages/PerfilPage";
import AdminDashboard from "./pages/AdminDashboard";
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import RelatorioMensalPage from "./pages/RelatorioMensalPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-xl gradient-primary animate-pulse" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-xl gradient-primary animate-pulse" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

import VersionMonitor from "./components/VersionMonitor";
import InstallPWA from "./components/InstallPWA";
import { useOfflineSync } from "./hooks/useOfflineSync";

function GlobalOfflineSync() {
  useOfflineSync();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GlobalOfflineSync />
      <InstallPWA />
      <VersionMonitor />
      <Toaster position="top-center" duration={3000} />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* PÃºblica */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

            {/* UsuÃ¡rio comum */}
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/nova-conta" element={<ProtectedRoute><NovaContaPage /></ProtectedRoute>} />
            <Route path="/conta/:id" element={<ProtectedRoute><ContaDetalhePage /></ProtectedRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><PerfilPage /></ProtectedRoute>} />

            {/* Admin only */}
            <Route path="/relatorios" element={<AdminRoute><RelatoriosPage /></AdminRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/usuarios" element={<AdminRoute><GerenciarUsuarios /></AdminRoute>} />
            <Route path="/admin/relatorio" element={<AdminRoute><RelatorioMensalPage /></AdminRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

