import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth }    from './context/AuthContext';
import PWAInstallPrompt             from './components/PWAInstallPrompt';
import LeonWidget                   from './components/LeonWidget';
import OnboardingGuard              from './components/OnboardingGuard';
import RecurringCheckRunner         from './components/RecurringCheckRunner';
import TransactionFAB               from './components/TransactionFAB';
import BackendWake                  from './components/BackendWake';

import LoginPage                    from './pages/LoginPage';
import Dashboard                    from './pages/Dashboard';
import AccountsPage                 from './pages/AccountsPage';
import CategoriesPage               from './pages/CategoriesPage';
import GoalsPage                    from './pages/GoalsPage';
import RecurringPage                from './pages/RecurringPage';
import InvestmentsPage              from './pages/InvestmentsPage';
import CalculatorsPage              from './pages/CalculatorsPage';
import BudgetsPage                  from './pages/BudgetsPage';
import ProjectionsPage              from './pages/ProjectionsPage';
import DebtsPage                    from './pages/DebtsPage';
import CreditCardsPage              from './pages/CreditCardsPage';
import ReportPage                   from './pages/ReportPage';
import CalendarPage                 from './pages/CalendarPage';
import NetWorthPage                 from './pages/NetWorthPage';
import AnnualPage                   from './pages/AnnualPage';
import ScheduledPage                from './pages/ScheduledPage';
import NotificationSettingsPage     from './pages/NotificationSettingsPage';
import CustomAlertsPage             from './pages/CustomAlertsPage';
import PlanningPage                 from './pages/PlanningPage';
import TransfersPage                from './pages/TransfersPage';
import HealthScorePage              from './pages/HealthScorePage';

function AuthWidgets() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <OnboardingGuard>
      <PWAInstallPrompt/>
      <LeonWidget/>
      <RecurringCheckRunner/>
      <TransactionFAB/>
    </OnboardingGuard>
  );
}

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
        <BackendWake/>
        <Routes>
          <Route path="/login"          element={<PublicRoute><LoginPage/></PublicRoute>}/>
          <Route path="/"               element={<PrivateRoute><Dashboard/></PrivateRoute>}/>
          <Route path="/accounts"       element={<PrivateRoute><AccountsPage/></PrivateRoute>}/>
          <Route path="/credit-cards"   element={<PrivateRoute><CreditCardsPage/></PrivateRoute>}/>
          <Route path="/investments"    element={<PrivateRoute><InvestmentsPage/></PrivateRoute>}/>
          <Route path="/goals"          element={<PrivateRoute><GoalsPage/></PrivateRoute>}/>
          <Route path="/debts"          element={<PrivateRoute><DebtsPage/></PrivateRoute>}/>
          <Route path="/recurring"      element={<PrivateRoute><RecurringPage/></PrivateRoute>}/>
          <Route path="/scheduled"      element={<PrivateRoute><ScheduledPage/></PrivateRoute>}/>
          <Route path="/transfers"      element={<PrivateRoute><TransfersPage/></PrivateRoute>}/>
          <Route path="/budgets"        element={<PrivateRoute><BudgetsPage/></PrivateRoute>}/>
          <Route path="/projections"    element={<PrivateRoute><ProjectionsPage/></PrivateRoute>}/>
          <Route path="/annual"         element={<PrivateRoute><AnnualPage/></PrivateRoute>}/>
          <Route path="/networth"       element={<PrivateRoute><NetWorthPage/></PrivateRoute>}/>
          <Route path="/calendar"       element={<PrivateRoute><CalendarPage/></PrivateRoute>}/>
          <Route path="/report"         element={<PrivateRoute><ReportPage/></PrivateRoute>}/>
          <Route path="/planning"       element={<PrivateRoute><PlanningPage/></PrivateRoute>}/>
          <Route path="/health"         element={<PrivateRoute><HealthScorePage/></PrivateRoute>}/>
          <Route path="/categories"     element={<PrivateRoute><CategoriesPage/></PrivateRoute>}/>
          <Route path="/calculators"    element={<PrivateRoute><CalculatorsPage/></PrivateRoute>}/>
          <Route path="/alerts"         element={<PrivateRoute><CustomAlertsPage/></PrivateRoute>}/>
          <Route path="/notifications"  element={<PrivateRoute><NotificationSettingsPage/></PrivateRoute>}/>
          <Route path="/notification-settings" element={<Navigate to="/notifications" replace/>}/>
          <Route path="*"              element={<Navigate to="/" replace/>}/>
        </Routes>
        <AuthWidgets/>
      </BrowserRouter>
    </AuthProvider>
  );
}
