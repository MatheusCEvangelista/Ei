import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import LoginPage       from './pages/LoginPage';
import Dashboard       from './pages/Dashboard';
import CategoriesPage  from './pages/CategoriesPage';
import GoalsPage       from './pages/GoalsPage';
import AccountsPage    from './pages/AccountsPage';
import RecurringPage   from './pages/RecurringPage';
import InvestmentsPage from './pages/InvestmentsPage';
import CalculatorsPage from './pages/CalculatorsPage';
import BudgetsPage     from './pages/BudgetsPage';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}
function PublicRoute({ children }) {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"       element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/"            element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/investments" element={<PrivateRoute><InvestmentsPage /></PrivateRoute>} />
          <Route path="/goals"       element={<PrivateRoute><GoalsPage /></PrivateRoute>} />
          <Route path="/accounts"    element={<PrivateRoute><AccountsPage /></PrivateRoute>} />
          <Route path="/recurring"   element={<PrivateRoute><RecurringPage /></PrivateRoute>} />
          <Route path="/categories"  element={<PrivateRoute><CategoriesPage /></PrivateRoute>} />
          <Route path="/calculators" element={<PrivateRoute><CalculatorsPage /></PrivateRoute>} />
          <Route path="/budgets"      element={<PrivateRoute><BudgetsPage /></PrivateRoute>} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
        <PWAInstallPrompt />
      </BrowserRouter>
    </AuthProvider>
  );
}
