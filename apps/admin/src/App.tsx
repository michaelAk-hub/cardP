import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Spinner } from './components/ui';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { StoresPage } from './pages/StoresPage';
import { AdvertisingPage } from './pages/AdvertisingPage';
import { AdminsPage } from './pages/AdminsPage';

function Protected({ children }: { children: JSX.Element }) {
  const { booting, isAuthenticated } = useAuth();
  if (booting) return <Spinner />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function LoginGate() {
  const { booting, isAuthenticated } = useAuth();
  if (booting) return <Spinner />;
  return isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginGate />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/stores" element={<StoresPage />} />
            <Route path="/advertising" element={<AdvertisingPage />} />
            <Route path="/admins" element={<AdminsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
