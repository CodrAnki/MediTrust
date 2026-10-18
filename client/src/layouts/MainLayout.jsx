import { Outlet } from 'react-router-dom';
import Navbar from '../components/layout/Navbar.jsx';
import Footer from '../components/layout/Footer.jsx';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
