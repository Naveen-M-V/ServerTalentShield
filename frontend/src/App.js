// src/App.js
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useState, useEffect } from "react";
import ModernSidebar from "./components/ModernSidebar";
import Topbar from "./components/Topbar";
import ErrorBoundary from "./components/ErrorBoundary";
import { APP_VERSION, BUILD_TIME } from "./version";
import { CertificateProvider } from "./context/CertificateContext";
import { ProfileProvider } from "./context/ProfileContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ClockStatusProvider } from "./context/ClockStatusContext";
import { AlertProvider } from "./components/AlertNotification";
import { initMemoryGuard } from "./utils/memoryGuard";
import AdminClockInWrapper from "./components/AdminClockInWrapper";

// Direct imports for faster navigation (no loading spinners)
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ProfilesPage from "./pages/ProfilesPage";
import CertificatesPage from "./pages/CertificatePage";
import MyAccount from "./pages/MyAccount";
import Notifications from "./pages/Notifications";
import ProfilesCreate from "./pages/ProfilesCreate";
import CreateCertificate from "./pages/CreateCertificate";
import Sharestaff from "./pages/ShareStaff";
import NoAccess from "./pages/NoAccess";
import EditUserProfile from "./pages/EditUserProfile";
import EditProfile from "./pages/EditProfile";
import EditEmployeeProfile from "./pages/EditEmployeeProfile";
import EditCertificate from "./pages/EditCertificate";
import ViewCertificate from "./pages/ViewCertificate";
import ProfileDetailView from "./pages/ProfileDetailView";
import Profile from "./pages/Profile";
import CertificateManagement from "./pages/CertificateManagement";
import Login from "./pages/Login";
import StaffDetail from "./pages/StaffDetail";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import UserDashboard from "./pages/UserDashboard";
// import CreateUser from "./pages/CreateUser"; // Removed - employees should be created via Employee Hub
import UserCertificateCreate from "./pages/UserCertificateCreate";
import UserCertificateView from "./pages/UserCertificateView";
import AdminDetailsModal from "./pages/AdminDetailsModal";
import RotaShiftManagement from "./pages/RotaShiftManagement";
import ClockInOut from "./pages/ClockInOut";
import EmployeeProfile from "./pages/EmployeeProfile";
import ClockIns from "./pages/ClockIns";
import TimeHistory from "./pages/TimeHistory";
import EmployeeHub from "./pages/EmployeeHub";
import ManageTeams from "./pages/ManageTeams";
import AddEmployee from "./pages/AddEmployee";
import ArchiveEmployees from "./pages/ArchiveEmployees";
import Calendar from "./pages/Calendar";
import OrganisationalChart from "./pages/OrganisationalChart";
import OrganizationalChartNew from "./pages/OrganizationalChartNew";
import AnnualLeaveBalance from './pages/AnnualLeaveBalance';
import ManagerApprovalDashboard from './pages/ManagerApprovalDashboard';
import Documents from './pages/Documents';
import FolderView from './pages/FolderView';
import ReportLibrary from './pages/ReportLibrary';
import Expenses from './pages/Expenses';
import AddExpense from './pages/AddExpense';
import ViewExpense from './pages/ViewExpense';
import AdminExpenses from './pages/AdminExpenses';
import Goals from './pages/Goals';
import Reviews from './pages/Reviews';
import ELearning from './pages/ELearning';
// Admin performance management
// Admin performance pages removed

// Note: ProtectedRoute removed as it's unused - AdminProtectedRoute and UserProtectedRoute handle all cases

// Admin Protected Route Component
function AdminProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  console.log('🛡️ AdminProtectedRoute check:', { 
    isAuthenticated, 
    loading, 
    userRole: user?.role,
    userType: user?.userType,
    hasUser: !!user 
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('❌ Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Only admin and super-admin can access admin dashboard
  if (user?.role !== "admin" && user?.role !== "super-admin") {
    console.log('⚠️ Not an admin, redirecting to user-dashboard. Role:', user?.role);
    // Redirect everyone else (employees and profiles) to user dashboard
    return <Navigate to="/user-dashboard" replace />;
  }

  console.log('✅ Admin access granted');
  return children;
}

// Any Authenticated User Route (for performance pages - both employees and admins)
function AuthenticatedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Employee Protected Route Component (for EmployeeHub users)
function EmployeeProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Allow employees and admins (admins can view as employees)
  const allowedRoles = ['employee', 'admin', 'super-admin'];
  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to="/user-dashboard" replace />;
  }

  return children;
}

// User Protected Route Component (for all non-admin users: profiles and employees)
function UserProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  console.log('🛡️ UserProtectedRoute check:', { 
    isAuthenticated, 
    loading, 
    userRole: user?.role,
    userType: user?.userType,
    hasUser: !!user 
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('❌ Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Redirect admins to their dashboard
  if (user?.role === "admin" || user?.role === "super-admin") {
    console.log('⚠️ Admin user, redirecting to admin dashboard. Role:', user?.role);
    return <Navigate to="/dashboard" replace />;
  }

  console.log('✅ User dashboard access granted');
  // Allow employees and profiles to access user dashboard
  return children;
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Initialize memory guard on app mount
  useEffect(() => {
    const cleanup = initMemoryGuard();
    console.log('✅ Memory Guard initialized');

    // Clear caches when page becomes hidden (user switches tabs)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('📱 Page hidden, performing cleanup...');
        try {
          const { storageGuard } = require('./utils/memoryGuard');
          storageGuard.cleanupOldCaches();
        } catch (err) {
          console.warn('Cleanup on hide failed:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (cleanup) cleanup();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Inline AdminLayout component with Outlet for nested routes
  function AdminLayout() {
    return (
      <ProfileProvider>
        <CertificateProvider>
          <div className="flex min-h-screen bg-gray-50">
            <ModernSidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
            <div
              className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? "ml-64" : "ml-16"}`}
            >
              <Topbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
              <div className="p-6 flex-1">
                <Outlet />
              </div>
            </div>
          </div>
        </CertificateProvider>
      </ProfileProvider>
    );
  }

  return (
    <AuthProvider>
      <ClockStatusProvider>
        <NotificationProvider>
          <AlertProvider>
            <AdminClockInWrapper>
              <Router>
                <Routes>
                  {/* Authentication routes without layout */}
                  <Route
                    path="/login"
                    element={
                      <ErrorBoundary>
                        <Login />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/signup"
                    element={
                      <ErrorBoundary>
                        <Signup />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/forgot-password"
                    element={
                      <ErrorBoundary>
                        <ForgotPassword />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/reset-password"
                    element={
                      <ErrorBoundary>
                        <ResetPassword />
                      </ErrorBoundary>
                    }
                  />

                  {/* User Dashboard Routes - No Sidebar */}
                  <Route
                    path="/user-dashboard"
                    element={
                      <UserProtectedRoute>
                        <ErrorBoundary>
                          <UserDashboard />
                        </ErrorBoundary>
                      </UserProtectedRoute>
                    }
                  />

                  {/* Employee-specific routes (employee portal) */}
                  <Route
                    path="/employee/expenses"
                    element={
                      <EmployeeProtectedRoute>
                        <ErrorBoundary>
                          {/* Redirect to dashboard tab so expenses appears as a tab under navbar */}
                          <Navigate to="/user-dashboard?tab=expenses" replace />
                        </ErrorBoundary>
                      </EmployeeProtectedRoute>
                    }
                  />

                  {/* Add new receipt/mileage paths — redirect into dashboard expenses tab (inline) */}
                  <Route
                    path="/employee/expenses/receipt/new"
                    element={
                      <EmployeeProtectedRoute>
                        <ErrorBoundary>
                          <Navigate to="/user-dashboard?tab=expenses&action=add&type=receipt" replace />
                        </ErrorBoundary>
                      </EmployeeProtectedRoute>
                    }
                  />

                  <Route
                    path="/employee/expenses/mileage/new"
                    element={
                      <EmployeeProtectedRoute>
                        <ErrorBoundary>
                          <Navigate to="/user-dashboard?tab=expenses&action=add&type=mileage" replace />
                        </ErrorBoundary>
                      </EmployeeProtectedRoute>
                    }
                  />

                  {/* User Certificate Routes */}
                  <Route
                    path="/user/certificates/create"
                    element={
                      <UserProtectedRoute>
                        <ErrorBoundary>
                          <UserCertificateCreate />
                        </ErrorBoundary>
                      </UserProtectedRoute>
                    }
                  />

                  <Route
                    path="/user/certificates/:id"
                    element={
                      <UserProtectedRoute>
                        <ErrorBoundary>
                          <UserCertificateView />
                        </ErrorBoundary>
                      </UserProtectedRoute>
                    }
                  />

                  {/* Admin routes with layout - Protected - React Router v6 compliant */}
                  <Route
                    path="/"
                    element={
                      <AdminProtectedRoute>
                        <AdminLayout />
                      </AdminProtectedRoute>
                    }
                  >
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/myaccount/profiles" element={<MyAccount />} />
                    <Route path="/myaccount/notifications" element={<Notifications />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/profiles" element={<ProfilesPage />} />
                    <Route path="/dashboard/profilescreate" element={<ProfilesCreate />} />
                    <Route path="/profiles/:id" element={<ProfileDetailView />} />
                    <Route path="/profiles/edit/:id" element={<EditUserProfile />} />
                    <Route path="/edit-user-profile/:id" element={<EditUserProfile />} />
                    <Route path="/edit-employee/:id" element={<EditEmployeeProfile />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/noaccess" element={<NoAccess />} />
                    <Route path="/editprofile" element={<EditProfile />} />
                    <Route path="/sharestaff" element={<Sharestaff />} />
                    <Route path="/staffdetail" element={<StaffDetail />} />
                    <Route path="/dashboard/createcertificate" element={<CreateCertificate />} />
                    <Route path="/reporting/certificates" element={<CertificatesPage />} />
                    <Route path="/certificates" element={<CertificateManagement />} />
                    <Route path="/editcertificate/:id" element={<EditCertificate />} />
                    <Route path="/viewcertificate/:id" element={<ViewCertificate />} />
                    <Route path="/reporting/profiles" element={<ProfilesPage />} />
                    <Route path="/dashboard/admin-details" element={<AdminDetailsModal />} />
                    <Route path="/rota-management" element={<RotaShiftManagement />} />
                    <Route path="/rota-shift-management" element={<RotaShiftManagement />} />
                    <Route path="/clock-overview" element={<ClockInOut />} />
                    <Route path="/clock-ins" element={<ClockIns />} />
                    <Route path="/time-history" element={<TimeHistory />} />
                    <Route path="/manage-teams" element={<ManageTeams />} />
                    <Route path="/employee-hub" element={<EmployeeHub />} />
                    <Route path="/archive-employees" element={<ArchiveEmployees />} />
                    <Route path="/organisational-chart" element={<OrganizationalChartNew />} />
                    <Route path="/add-employee" element={<AddEmployee />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/employee/:employeeId" element={<EmployeeProfile />} />
                    <Route path="/annual-leave-balance" element={<AnnualLeaveBalance />} />
                    <Route path="/manager-approvals" element={<ManagerApprovalDashboard />} />
                    <Route path="/report-library" element={<ReportLibrary />} />
                    <Route path="/expenses" element={<Expenses />} />
                    <Route path="/admin/expenses" element={<AdminExpenses />} />
                    <Route path="/expenses/add" element={<AddExpense />} />
                    <Route path="/expenses/:id" element={<ViewExpense />} />
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/documents/:folderId" element={<FolderView />} />
                    {/* Performance routes removed from admin - now standalone below */}
                    {/* Admin performance routes removed */}
                    <Route path="/e-learning" element={<ELearning />} />
                  </Route>

                  {/* Performance routes - accessible by both employees and admins */}
                  <Route
                    path="/performance/goals"
                    element={
                      <AuthenticatedRoute>
                        <Goals />
                      </AuthenticatedRoute>
                    }
                  />
                  <Route
                    path="/performance/reviews"
                    element={
                      <AuthenticatedRoute>
                        <Reviews />
                      </AuthenticatedRoute>
                    }
                  />
                </Routes>
              </Router>
            </AdminClockInWrapper>
          </AlertProvider>
        </NotificationProvider>
      </ClockStatusProvider>
    </AuthProvider>
  );
}

export default App;