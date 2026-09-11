import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth }    from './context/AuthContext';
import { ThemeProvider }            from './context/ThemeContext';
import PWAInstallPrompt             from './components/PWAInstallPrompt';
import LeonWidget                   from './components/LeonWidget';
import OnboardingGuard              from './components/OnboardingGuard';
import RecurringCheckRunner         from './components/RecurringCheckRunner';
import TransactionFAB               from './components/TransactionFAB';
import BackendWake                  from './components/BackendWake';

// Lazy loading — cada página só carrega quando acessada
const LoginPage                = lazy(()=>import('./pages/LoginPage'));
const Dashboard                = lazy(()=>import('./pages/Dashboard'));
const AccountsPage             = lazy(()=>import('./pages/AccountsPage'));
const CategoriesPage           = lazy(()=>import('./pages/CategoriesPage'));
const GoalsPage                = lazy(()=>import('./pages/GoalsPage'));
const RecurringPage            = lazy(()=>import('./pages/RecurringPage'));
const InvestmentsPage          = lazy(()=>import('./pages/InvestmentsPage'));
const CalculatorsPage          = lazy(()=>import('./pages/CalculatorsPage'));
const BudgetsPage              = lazy(()=>import('./pages/BudgetsPage'));
const ProjectionsPage          = lazy(()=>import('./pages/ProjectionsPage'));
const DebtsPage                = lazy(()=>import('./pages/DebtsPage'));
const CreditCardsPage          = lazy(()=>import('./pages/CreditCardsPage'));
const ReportPage               = lazy(()=>import('./pages/ReportPage'));
const CalendarPage             = lazy(()=>import('./pages/CalendarPage'));
const NetWorthPage             = lazy(()=>import('./pages/NetWorthPage'));
const AnnualPage               = lazy(()=>import('./pages/AnnualPage'));
const ScheduledPage            = lazy(()=>import('./pages/ScheduledPage'));
const NotificationSettingsPage = lazy(()=>import('./pages/NotificationSettingsPage'));
const CustomAlertsPage         = lazy(()=>import('./pages/CustomAlertsPage'));
const PlanningPage             = lazy(()=>import('./pages/PlanningPage'));
const TransfersPage            = lazy(()=>import('./pages/TransfersPage'));
const HealthScorePage          = lazy(()=>import('./pages/HealthScorePage'));
const ProfilePage              = lazy(()=>import('./pages/ProfilePage'));

// Fallback de carregamento entre páginas
function PageLoader() {
  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
        <img src="/leon/analyzing.png" alt="Carregando..." style={{width:80,height:80,objectFit:'contain',animation:'leon-float 1.5s ease-in-out infinite'}}/>
        <p style={{fontSize:13,color:'var(--text3)',fontFamily:'var(--font)'}}>Carregando...</p>
      </div>
      <style>{`@keyframes leon-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </div>
  );
}

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
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <BackendWake/>
          <Suspense fallback={<PageLoader/>}>
            <Routes>
              <Route path="/login"         element={<PublicRoute><LoginPage/></PublicRoute>}/>
              <Route path="/"              element={<PrivateRoute><Dashboard/></PrivateRoute>}/>
              <Route path="/accounts"      element={<PrivateRoute><AccountsPage/></PrivateRoute>}/>
              <Route path="/credit-cards"  element={<PrivateRoute><CreditCardsPage/></PrivateRoute>}/>
              <Route path="/investments"   element={<PrivateRoute><InvestmentsPage/></PrivateRoute>}/>
              <Route path="/goals"         element={<PrivateRoute><GoalsPage/></PrivateRoute>}/>
              <Route path="/debts"         element={<PrivateRoute><DebtsPage/></PrivateRoute>}/>
              <Route path="/recurring"     element={<PrivateRoute><RecurringPage/></PrivateRoute>}/>
              <Route path="/scheduled"     element={<PrivateRoute><ScheduledPage/></PrivateRoute>}/>
              <Route path="/transfers"     element={<PrivateRoute><TransfersPage/></PrivateRoute>}/>
              <Route path="/budgets"       element={<PrivateRoute><BudgetsPage/></PrivateRoute>}/>
              <Route path="/projections"   element={<PrivateRoute><ProjectionsPage/></PrivateRoute>}/>
              <Route path="/annual"        element={<PrivateRoute><AnnualPage/></PrivateRoute>}/>
              <Route path="/networth"      element={<PrivateRoute><NetWorthPage/></PrivateRoute>}/>
              <Route path="/calendar"      element={<PrivateRoute><CalendarPage/></PrivateRoute>}/>
              <Route path="/report"        element={<PrivateRoute><ReportPage/></PrivateRoute>}/>
              <Route path="/planning"      element={<PrivateRoute><PlanningPage/></PrivateRoute>}/>
              <Route path="/health"        element={<PrivateRoute><HealthScorePage/></PrivateRoute>}/>
              <Route path="/categories"    element={<PrivateRoute><CategoriesPage/></PrivateRoute>}/>
              <Route path="/calculators"   element={<PrivateRoute><CalculatorsPage/></PrivateRoute>}/>
              <Route path="/alerts"        element={<PrivateRoute><CustomAlertsPage/></PrivateRoute>}/>
              <Route path="/notifications" element={<PrivateRoute><NotificationSettingsPage/></PrivateRoute>}/>
              <Route path="/profile"       element={<PrivateRoute><ProfilePage/></PrivateRoute>}/>
              <Route path="/notification-settings" element={<Navigate to="/notifications" replace/>}/>
              <Route path="*"             element={<Navigate to="/" replace/>}/>
            </Routes>
          </Suspense>
          <AuthWidgets/>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
