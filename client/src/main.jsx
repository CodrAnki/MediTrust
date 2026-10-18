import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { VerificationProvider } from './context/VerificationContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <VerificationProvider>
          <App />
        </VerificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
