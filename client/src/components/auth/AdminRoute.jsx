import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import LoadingScreen from '../ui/LoadingScreen.jsx';

// Wrap any route tree that requires an authenticated admin user.
// Usage: <Route element={<AdminRoute />}> ... </Route>
export default function AdminRoute() {
  const { isAuthenticated, isAdmin, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdmin) {
    // Signed in, but not an admin: the server would reject every admin API call
    // anyway (403); this just avoids showing an empty admin shell.
    return <Navigate to="/admin/login" replace state={{ from: location.pathname, forbidden: true }} />;
  }

  return <Outlet />;
}
