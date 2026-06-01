import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Pricing from "./pages/Pricing";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Overview from "./pages/dashboard/Overview";
import Bots from "./pages/dashboard/Bots";
import Groups from "./pages/dashboard/Groups";
import Knowledge from "./pages/dashboard/Knowledge";
import Messages from "./pages/dashboard/Messages";
import Playground from "./pages/dashboard/Playground";
import Billing from "./pages/dashboard/Billing";
import Settings from "./pages/dashboard/Settings";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminBots from "./pages/admin/AdminBots";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminModeration from "./pages/admin/AdminModeration";
import AdminActivity from "./pages/admin/AdminActivity";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/reset-password" element={<ResetPassword />} />


            <Route path="/dashboard" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
            <Route path="/dashboard/bots" element={<ProtectedRoute><Bots /></ProtectedRoute>} />
            <Route path="/dashboard/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
            <Route path="/dashboard/knowledge" element={<ProtectedRoute><Knowledge /></ProtectedRoute>} />
            <Route path="/dashboard/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/dashboard/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            <Route path="/admin" element={<ProtectedRoute ownerOnly><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute ownerOnly><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/bots" element={<ProtectedRoute ownerOnly><AdminBots /></ProtectedRoute>} />
            <Route path="/admin/messages" element={<ProtectedRoute ownerOnly><AdminMessages /></ProtectedRoute>} />
            <Route path="/admin/moderation" element={<ProtectedRoute ownerOnly><AdminModeration /></ProtectedRoute>} />
            <Route path="/admin/activity" element={<ProtectedRoute ownerOnly><AdminActivity /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
