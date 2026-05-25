import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { EmpresaProvider, useEmpresa } from "@/contexts/EmpresaContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import NovaContaPage from "./pages/NovaContaPage";
import ContaDetalhePage from "./pages/ContaDetalhePage";
import RelatoriosPage from "./pages/RelatoriosPage";
import PerfilPage from "./pages/PerfilPage";
import AdminDashboard from "./pages/AdminDashboard";
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import RelatorioMensalPage from "./pages/RelatorioMensalPage";
import CompanySelectorPage from "./pages/CompanySelectorPage";
import NotFound from "./pages/NotFound";
import FuncionariosPage from "./pages/rh/FuncionariosPage";
import NovoFuncionarioPage from "./pages/rh/NovoFuncionarioPage";
import FuncionarioDetalhePage from "./pages/rh/FuncionarioDetalhePage";
import InstallPWA from "./components/InstallPWA";
import { useOfflineSync } from "./hooks/useOfflineSync";

const queryClient = new QueryClient();

function Spinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-xl gradient-primary animate-pulse" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Spinner />;
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

// Requires auth AND active empresa. Redirects to /empresas if no empresa selected.
function EmpresaRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { empresaAtiva, loading: empresaLoading } = useEmpresa();
  if (authLoading || empresaLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!empresaAtiva) return <Navigate to="/empresas" replace />;
  return <>{children}</>;
}

function GlobalOfflineSync() {
  useOfflineSync();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GlobalOfflineSync />
      <InstallPWA />
      <Toaster position="top-center" duration={3000} />
      <BrowserRouter>
        <AuthProvider>
          <EmpresaProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

              {/* Company selector — requires auth, no empresa needed */}
              <Route path="/empresas" element={<ProtectedRoute><CompanySelectorPage /></ProtectedRoute>} />

              {/* User routes — requires auth + active empresa */}
              <Route path="/" element={<EmpresaRoute><DashboardPage /></EmpresaRoute>} />
              <Route path="/nova-conta" element={<EmpresaRoute><NovaContaPage /></EmpresaRoute>} />
              <Route path="/conta/:id" element={<EmpresaRoute><ContaDetalhePage /></EmpresaRoute>} />
              <Route path="/perfil" element={<EmpresaRoute><PerfilPage /></EmpresaRoute>} />

              {/* RH */}
              <Route path="/rh/funcionarios" element={<EmpresaRoute><FuncionariosPage /></EmpresaRoute>} />
              <Route path="/rh/funcionarios/novo" element={<EmpresaRoute><NovoFuncionarioPage /></EmpresaRoute>} />
              <Route path="/rh/funcionarios/:id" element={<EmpresaRoute><FuncionarioDetalhePage /></EmpresaRoute>} />

              {/* Admin only */}
              <Route path="/relatorios" element={<AdminRoute><RelatoriosPage /></AdminRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/usuarios" element={<AdminRoute><GerenciarUsuarios /></AdminRoute>} />
              <Route path="/admin/relatorio" element={<AdminRoute><RelatorioMensalPage /></AdminRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </EmpresaProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
