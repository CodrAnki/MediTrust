import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import LoadingScreen from '../ui/LoadingScreen.jsx';

// Wrap any route tree that requires a logged-in user.
// Usage: <Route element={<ProtectedRoute />}> ... </Route>
export default function ProtectedRoute() {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
