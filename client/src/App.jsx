import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout.jsx';
import Home from './pages/Home.jsx';
import Verify from './pages/Verify.jsx';
import VerifyReview from './pages/VerifyReview.jsx';
import VerifyProcessing from './pages/VerifyProcessing.jsx';
import VerifyResult from './pages/VerifyResult.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import About from './pages/About.jsx';
import Placeholder from './pages/Placeholder.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminMedicines from './pages/admin/AdminMedicines.jsx';
import AdminReferenceImages from './pages/admin/AdminReferenceImages.jsx';
import AdminBatches from './pages/admin/AdminBatches.jsx';
import AdminCodes from './pages/admin/AdminCodes.jsx';
import AdminVerifications from './pages/admin/AdminVerifications.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminAuditLogs from './pages/admin/AdminAuditLogs.jsx';
import { AdminRiskEngine, AdminSettings } from './pages/admin/AdminSettingsPages.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ScanHistory from './pages/ScanHistory.jsx';
import NotFound from './pages/NotFound.jsx';
import Faq from './pages/Faq.jsx';
import Contact from './pages/Contact.jsx';
import Legal from './pages/Legal.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import AdminRoute from './components/auth/AdminRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about" element={<About />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Legal kind="privacy" />} />
        <Route path="/terms" element={<Legal kind="terms" />} />

        {/* Requires login before uploading photos for authenticated extraction,
            field review, and final verification. */}
        <Route element={<ProtectedRoute />}>
          <Route path="/verify" element={<Verify />} />
          <Route path="/verify/review" element={<VerifyReview />} />
          <Route path="/verify/processing" element={<VerifyProcessing />} />
          <Route path="/verify/result/:id" element={<VerifyResult />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/history" element={<ScanHistory />} />
          <Route path="/profile" element={<Placeholder title="Profile" phase="Phase 2 follow-up" />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Admin app: its own layout. The login page is public; everything else
          needs an admin session (and the server re-checks every API call). */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/medicines" element={<AdminMedicines />} />
          <Route path="/admin/reference-images" element={<AdminReferenceImages />} />
          <Route path="/admin/batches" element={<AdminBatches />} />
          <Route path="/admin/codes" element={<AdminCodes />} />
          <Route path="/admin/verifications" element={<AdminVerifications />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/risk-engine" element={<AdminRiskEngine />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
        </Route>
      </Route>
    </Routes>
  );
}
