import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MedicinesPage from './pages/MedicinesPage';
import WeeklySummaryPage from './pages/WeeklySummaryPage';
import AIAssistantPage from './pages/AIAssistantPage';
import CaregiverDashboardPage from './pages/CaregiverDashboardPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="animate-pulse-soft text-elder-2xl">💊</div>
    </div>
  );
  return user ? children : <Navigate to="/login" />;
}

function CaregiverRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'caregiver') return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  // Send caregivers straight to their patients page, not the patient dashboard
  const defaultRoute = user?.role === 'caregiver' ? '/caregiver' : '/';
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={defaultRoute} /> : <LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout><DashboardPage /></Layout></PrivateRoute>} />
      <Route path="/medicines" element={<PrivateRoute><Layout><MedicinesPage /></Layout></PrivateRoute>} />
      <Route path="/summary" element={<PrivateRoute><Layout><WeeklySummaryPage /></Layout></PrivateRoute>} />
      <Route path="/ai-assistant" element={<PrivateRoute><Layout><AIAssistantPage /></Layout></PrivateRoute>} />
      <Route path="/caregiver" element={<CaregiverRoute><Layout><CaregiverDashboardPage /></Layout></CaregiverRoute>} />
      <Route path="*" element={<Navigate to={defaultRoute} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
