import React, { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getClockStatus, clockIn, clockOut, changeEmployeeStatus, getDashboardStats, setOnBreak, deleteTimeEntry, userClockIn, userClockOut, userStartBreak } from '../utils/clockApi';
import LoadingScreen from '../components/LoadingScreen';
import EmployeeTimesheetModal from '../components/EmployeeTimesheetModal';
import TimelineBar from '../components/TimelineBar';
import { DatePicker } from '../components/ui/date-picker';
import MUITimePicker from '../components/MUITimePicker';
import dayjs from 'dayjs';
import moment from 'moment-timezone';
import { useAuth } from '../context/AuthContext';
import { useClockStatus } from '../context/ClockStatusContext';
import { formatUKTimeOnly } from '../utils/timeUtils';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from '../components/ui/pagination';
import ConfirmDialog from '../components/ConfirmDialog';

/**
 * Clock-ins Page
 * Shows detailed employee list with clock in/out functionality
 * NO DEMO DATA - All data from backend with proper error handling
 */

const ClockIns = () => {
  const { user: currentUser } = useAuth();
  const { refreshTrigger, triggerClockRefresh } = useClockStatus();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    role: 'All Roles',
    staffType: 'All Staff Types',
    company: 'All Companies',
    manager: 'All Managers'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showEntries, setShowEntries] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState({ id: null, name: '' });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [myStatus, setMyStatus] = useState(null); // Admin's own clock status
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({ date: '', clockIn: '', clockOut: '' });
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [clockInEmployee, setClockInEmployee] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null); // null means show all
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [showTimesheetModal, setShowTimesheetModal] = useState(false);
  const [selectedFromSearch, setSelectedFromSearch] = useState(false); // Track if employee was selected from search bar
  const [clockInGeoLocation, setClockInGeoLocation] = useState(null);

  useEffect(() => {
    fetchData();
    fetchMyStatus(); // Fetch admin's own clock status on page load
    // Auto-refresh every 15 seconds for real-time sync (polling-based)
    // Cross-tab updates are handled by ClockStatusContext (instant)
    const interval = setInterval(() => {
      fetchData();
      fetchMyStatus();
    }, 15000); // 15 seconds for near real-time updates
    return () => clearInterval(interval);
  }, []);

  // Listen to clock refresh trigger from UserDashboard
  // This provides instant updates when users clock in/out
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('🔄 Clock refresh triggered from UserDashboard, fetching latest data...');
      fetchData();
      fetchMyStatus(); // Also refresh admin's own status
    }
  }, [refreshTrigger]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmployeeDropdown && !event.target.closest('.employee-search-container')) {
        setShowEmployeeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmployeeDropdown]);

  const fetchMyStatus = async () => {
    try {
      // Fetch admin's own clock status using user status endpoint
      const { getUserClockStatus } = require('../utils/clockApi');
      const response = await getUserClockStatus();

      if (response.success) {
        console.log('✅ Admin clock status loaded:', response.data);
        setMyStatus(response.data);
      } else {
        setMyStatus(null);
      }
    } catch (error) {
      console.error('❌ Failed to fetch admin clock status:', error);
      setMyStatus(null);
    }
  };

  const fetchData = async () => {
    try {
      console.log('🔄 Fetching clock-ins data...');
      setStatsLoading(true);

      // Fetch EmployeeHub data, clock status, and stats in parallel
      const [employeesRes, clockStatusRes, statsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_BASE_URL}/employees?includeAdmins=true`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Accept': 'application/json'
          }
        }).then(res => res.json()),
        getClockStatus({ includeAdmins: true }),
        getDashboardStats()
      ]);

      console.log('👥 Employees Response:', employeesRes);
      console.log('⏰ Clock Status Response:', clockStatusRes);
      console.log('📊 Stats Response:', statsRes);

      // Handle the new clock status response structure
      let clockStatusData = [];
      if (clockStatusRes.success && clockStatusRes.data) {
        // Use the main employee list from the new structure
        clockStatusData = Array.isArray(clockStatusRes.data) ? clockStatusRes.data : [];
      } else if (clockStatusRes.allEmployees) {
        // Fallback to allEmployees if available
        clockStatusData = clockStatusRes.allEmployees;
      }

      console.log('📍 Processed clock status data:', clockStatusData.length, 'employees');

      if (employeesRes?.success && employeesRes.data) {
        // Transform EmployeeHub data to include clock status
        const employeesWithClockStatus = employeesRes.data.map(emp => ({
          ...emp,
          name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
          status: 'clocked_out', // Default status - will be updated by clock status API
          clockStatus: 'clocked_out',
          clockIn: null,
          clockOut: null
        }));

        // Update with actual clock status from the new API response
        if (clockStatusData.length > 0) {
          const clockStatusMap = {};
          const employeeEmailSet = new Set(employeesWithClockStatus.map(e => e.email));
          
          clockStatusData.forEach(clockEmp => {
            // Use email or ID to match employees
            const key = clockEmp.email || clockEmp.id || clockEmp._id;
            if (key) {
              clockStatusMap[key] = clockEmp;
              console.log('🔍 Backend clock status for', key, ':', clockEmp.status);
            }
          });

          // Update existing employees with clock status
          employeesWithClockStatus.forEach(emp => {
            // Try to match by email first, then by ID
            const matchByEmail = clockStatusMap[emp.email];
            const matchById = clockStatusMap[emp.id] || clockStatusMap[emp._id];
            const clockData = matchByEmail || matchById;

            if (clockData) {
              emp.status = clockData.status || 'clocked_out';
              emp.clockStatus = clockData.status || 'clocked_out';
              emp.clockIn = clockData.clockIn;
              emp.clockOut = clockData.clockOut;
              emp.breakIn = clockData.breakIn;
              emp.breakOut = clockData.breakOut;
              console.log('🔍 Updated employee status:', emp.email, '→', emp.status);
            }
          });
          
          // Add any clocked-in admins/superadmins who are NOT in EmployeeHub
          clockStatusData.forEach(clockEmp => {
            const isInEmployeeHub = clockEmp.email && employeeEmailSet.has(clockEmp.email);
            const isAdminRole = clockEmp.role === 'admin' || clockEmp.role === 'super-admin';
            
            if (!isInEmployeeHub && isAdminRole && clockEmp.status && clockEmp.status !== 'clocked_out') {
              // This is an admin/superadmin who clocked in but isn't in EmployeeHub
              console.log('➕ Adding clocked-in admin to list:', clockEmp.email, clockEmp.role, clockEmp.status);
              employeesWithClockStatus.push({
                ...clockEmp,
                name: clockEmp.name || `${clockEmp.firstName || ''} ${clockEmp.lastName || ''}`.trim(),
                status: clockEmp.status,
                clockStatus: clockEmp.status,
                clockIn: clockEmp.clockIn,
                clockOut: clockEmp.clockOut,
                breakIn: clockEmp.breakIn,
                breakOut: clockEmp.breakOut,
                role: clockEmp.role,
                isAdmin: true
              });
            }
          });
        }

        setEmployees(employeesWithClockStatus);

        // Always calculate stats from the full employee list for accuracy
        calculateStatsFromEmployees(employeesWithClockStatus);

        // Fetch attendance status for late/absent counts
        try {
          const attendanceRes = await fetch(`${process.env.REACT_APP_API_BASE_URL}/clock/attendance-status`, {
            credentials: 'include'
          });
          if (attendanceRes.ok) {
            const attendanceData = await attendanceRes.json();
            if (attendanceData.success && attendanceData.data) {
              console.log('📊 Attendance status:', attendanceData.data);
              // Update stats with accurate late/absent counts
              setStats(prevStats => ({
                ...prevStats,
                late: attendanceData.data.summary.late || 0,
                absent: attendanceData.data.summary.absent || 0
              }));
            }
          }
        } catch (error) {
          console.error('Error fetching attendance status:', error);
        }

        // Also use backend stats if available for comparison
        if (statsRes.success) {
          console.log('📊 Backend stats:', statsRes.data);
        } else {
          console.log('⚠️ Backend stats failed, using frontend calculation');
        }
      } else {
        console.warn('⚠️ EmployeeHub clock status fetch failed');
        setEmployees([]);
        setStats({ clockedIn: 0, onBreak: 0, clockedOut: 0, total: 0 });
        setStatsLoading(false);
      }
    } catch (error) {
      console.error('❌ Fetch data error:', error);
      toast.error('Failed to fetch data');
      setEmployees([]);
      setStats({ clockedIn: 0, onBreak: 0, clockedOut: 0, total: 0 });
      setStatsLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatsFromEmployees = (employeeList) => {
    console.log('📊 Calculating stats from employees:', employeeList.length, 'employees');
    // Count based on current status, not just today's clock-ins
    // This ensures accurate counts for multiple clock-ins per day
    const calculated = {
      clockedIn: employeeList.filter(e => e.status === 'clocked_in').length,
      onBreak: employeeList.filter(e => e.status === 'on_break').length,
      clockedOut: employeeList.filter(e => e.status === 'clocked_out').length,
      onLeave: employeeList.filter(e => e.status === 'on_leave').length,
      absent: employeeList.filter(e => e.status === 'absent').length,
      late: 0, // Will be updated by attendance API
      total: employeeList.length
    };
    console.log('📊 Calculated stats from employees:', calculated);
    setStats(calculated);
    setStatsLoading(false);
  };

  const openClockInModal = (employee) => {
    // Open clock-in modal directly
    // Backend will validate if employee can clock in (must be clocked out first)
    setClockInEmployee(employee);
    setShowClockInModal(true);
  };

  const confirmClockIn = async () => {
    if (!clockInEmployee) {
      toast.error('No employee selected');
      return;
    }

    const employeeId = clockInEmployee.id || clockInEmployee._id;
    const isAdmin = clockInEmployee.role === 'admin';
    const isCurrentUser = currentUser?.email === clockInEmployee.email;

    console.log('🔍 Clock In Debug - Full Employee Object:', clockInEmployee);
    console.log('Clock In - Employee ID:', employeeId);
    console.log('Clock In - Is Admin:', isAdmin);
    console.log('Clock In - Is Current User:', isCurrentUser);
    console.log('Clock In - Current Status:', clockInEmployee.status);
    console.log('Employee ID type:', typeof employeeId);

    if (!employeeId) {
      console.error('❌ Employee ID is undefined! Employee object:', clockInEmployee);
      toast.error('Invalid employee data. Please refresh and try again.');
      setShowClockInModal(false);
      return;
    }

    setShowClockInModal(false);

    try {
      let response;
      let gpsData = {};

      // ========== GPS LOCATION CAPTURE ==========
      // Capture GPS for both self clock-in and admin clocking in employees
      if (navigator.geolocation) {
        try {
          console.log('📍 Capturing GPS location for clock-in...');
          const locationToast = toast.info('Capturing location...', { autoClose: false });

          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              }
            );
          });

          gpsData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };

          toast.dismiss(locationToast);
          console.log('✅ GPS captured:', gpsData);
        } catch (gpsError) {
          console.warn('⚠️ GPS capture failed:', gpsError);
          // Continue without GPS - don't block clock-in
        }
      }
      // ==========================================

      // If clocking in yourself (current user), use userClockIn
      // Otherwise, use admin clockIn to clock in another employee
      if (isCurrentUser) {
        response = await userClockIn({
          location: 'Work From Office',
          workType: 'Regular',
          ...gpsData  // Include GPS data
        });
      } else {
        const payload = {
          employeeId,
          ...gpsData  // Include GPS data for admin clocking in employees
        };
        response = await clockIn(payload);
      }

      if (response.success) {
        toast.success(isCurrentUser ? 'You have clocked in successfully' : 'Employee clocked in successfully');

        // Store geolocation data
        if (gpsData.latitude && gpsData.longitude) {
          setClockInGeoLocation({
            latitude: gpsData.latitude,
            longitude: gpsData.longitude,
            accuracy: gpsData.accuracy,
            timestamp: moment().tz('Europe/London').format('HH:mm')
          });
        }

        // Immediately update the employee status in the list for instant UI feedback
        setEmployees(prevEmployees =>
          prevEmployees.map(emp =>
            (emp.id === employeeId || emp._id === employeeId)
              ? {
                ...emp,
                status: 'clocked_in',
                clockIn: response.data?.timeEntry?.clockIn || new Date().toTimeString().slice(0, 5),
                timeEntryId: response.data?.timeEntry?._id || emp.timeEntryId
              }
              : emp
          )
        );

        // Update selected employee status
        setSelectedEmployee(prev => prev ? { ...prev, status: 'clocked_in' } : null);

        // Trigger refresh for UserDashboard and all other tabs
        triggerClockRefresh({
          action: 'ADMIN_CLOCK_IN',
          employeeId: employeeId,
          employeeName: clockInEmployee?.firstName && clockInEmployee?.lastName
            ? `${clockInEmployee.firstName} ${clockInEmployee.lastName}`
            : 'Employee',
          adminName: currentUser?.firstName && currentUser?.lastName
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : 'Admin',
          timestamp: Date.now()
        });

        // Wait a moment for backend to fully process, then fetch fresh data
        setTimeout(async () => {
          await fetchData();
          await fetchMyStatus(); // Refresh admin's own status

          // Debug: Check what status we actually got back
          const updatedEmployee = employees.find(emp => emp.id === employeeId || emp._id === employeeId);
          console.log('🔍 Employee status after clock-in:', {
            employeeId,
            status: updatedEmployee?.status,
            clockStatus: updatedEmployee?.clockStatus,
            fullEmployee: updatedEmployee
          });
        }, 1000);
      } else {
        toast.error(response.message || 'Failed to clock in');
      }
    } catch (error) {
      console.error('❌ Clock in error:', error);
      console.error('❌ Error response data:', error.response?.data);
      console.error('❌ Error response status:', error.response?.status);
      console.error('❌ Error message:', error.message);
      console.error('❌ Full error object:', JSON.stringify(error, null, 2));

      // The error might be thrown directly from clockApi.js as {success: false, message: "..."}
      // or as an axios error with error.response.data
      const errorMsg = error.message || error.response?.data?.message || 'Failed to clock in';

      // Show the error message from backend
      toast.error(errorMsg);

      // Refresh to sync state
      await fetchData();
      await fetchMyStatus();
    }
  };

  const handleClockOut = async (employeeId) => {
    if (!employeeId) {
      toast.error('Invalid employee ID');
      return;
    }

    // Find the employee to check if it's the current user
    const employee = employees.find(emp => emp.id === employeeId || emp._id === employeeId);
    const isCurrentUser = currentUser?.email === employee?.email;

    console.log('🔍 Clock Out - Employee ID:', employeeId);
    console.log('🔍 Clock Out - Is Current User:', isCurrentUser);

    // Optimistic update
    setEmployees(prevEmployees =>
      prevEmployees.map(emp =>
        (emp.id === employeeId || emp._id === employeeId)
          ? { ...emp, status: 'clocked_out' }
          : emp
      )
    );

    // Also update selected employee if it matches
    setSelectedEmployee(prev =>
      prev && (prev.id === employeeId || prev._id === employeeId)
        ? { ...prev, status: 'clocked_out' }
        : prev
    );

    try {
      let response;
      let gpsData = {};

      // ========== GPS LOCATION CAPTURE FOR CLOCK-OUT ==========
      if (navigator.geolocation) {
        try {
          console.log('📍 Capturing GPS location for clock-out...');
          const locationToast = toast.info('Capturing location...', { autoClose: false });

          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              }
            );
          });

          gpsData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };

          toast.dismiss(locationToast);
          console.log('✅ GPS captured for clock-out:', gpsData);
        } catch (gpsError) {
          console.warn('⚠️ GPS capture failed for clock-out:', gpsError);
          // Continue without GPS - don't block clock-out
        }
      }
      // ========================================================

      // If clocking out yourself, use userClockOut
      if (isCurrentUser) {
        console.log('📤 Using userClockOut (self clock-out)');
        console.log('Current user email:', currentUser?.email);
        console.log('Employee email:', employee?.email);
        response = await userClockOut(gpsData);
      } else {
        console.log('📤 Using clockOut (admin clocking out employee)');
        console.log('Employee ID being sent:', employeeId);
        response = await clockOut({ employeeId, ...gpsData });
      }

      console.log('📥 Clock out response:', response);

      if (response.success) {
        toast.success(isCurrentUser ? 'You have clocked out successfully' : 'Employee clocked out successfully');

        // Update with response data
        setEmployees(prevEmployees =>
          prevEmployees.map(emp =>
            (emp.id === employeeId || emp._id === employeeId)
              ? {
                ...emp,
                status: 'clocked_out',
                clockOut: response.data?.timeEntry?.clockOut || new Date().toTimeString().slice(0, 5),
                hoursWorked: response.data?.hoursWorked || emp.hoursWorked
              }
              : emp
          )
        );

        // Trigger refresh for UserDashboard and all other tabs
        triggerClockRefresh({
          action: 'ADMIN_CLOCK_OUT',
          employeeId: employeeId,
          employeeName: employee?.firstName && employee?.lastName
            ? `${employee.firstName} ${employee.lastName}`
            : 'Employee',
          adminName: currentUser?.firstName && currentUser?.lastName
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : 'Admin',
          hoursWorked: response.data?.hoursWorked || 0,
          timestamp: Date.now()
        });

        // Wait before fetching fresh data
        setTimeout(async () => {
          await fetchData();
          await fetchMyStatus(); // Refresh admin's own status
        }, 1000);
      } else {
        toast.error(response.message || 'Failed to clock out');
        await fetchData(); // Revert on failure
        await fetchMyStatus();
      }
    } catch (error) {
      console.error('❌ Clock out error:', error);
      console.error('❌ Error response data:', error.response?.data);
      console.error('❌ Error response status:', error.response?.status);
      console.error('❌ Error message:', error.message);
      console.error('❌ Full error object:', JSON.stringify(error, null, 2));

      const errorMessage = error.response?.data?.message || error.message || 'Failed to clock out';
      toast.error(`Clock out failed: ${errorMessage}`);
      await fetchData(); // Revert on error
      await fetchMyStatus();
    }
  };

  const handleOnBreak = async (employeeId) => {
    if (!employeeId) {
      toast.error('Invalid employee ID');
      return;
    }

    // Find the employee to check if it's the current user
    const employee = employees.find(emp => emp.id === employeeId || emp._id === employeeId);
    const isCurrentUser = currentUser?.email === employee?.email;

    console.log('🔍 On Break - Employee ID:', employeeId);
    console.log('🔍 On Break - Is Current User:', isCurrentUser);

    // Optimistic update
    setEmployees(prevEmployees =>
      prevEmployees.map(emp =>
        (emp.id === employeeId || emp._id === employeeId)
          ? { ...emp, status: 'on_break' }
          : emp
      )
    );

    // Also update selected employee if it matches
    setSelectedEmployee(prev =>
      prev && (prev.id === employeeId || prev._id === employeeId)
        ? { ...prev, status: 'on_break' }
        : prev
    );

    try {
      let response;

      // If setting yourself on break, use userStartBreak
      if (isCurrentUser) {
        console.log('📤 Using userStartBreak (self break)');
        response = await userStartBreak();
      } else {
        console.log('📤 Using setOnBreak (admin setting employee on break)');
        response = await setOnBreak(employeeId);
      }

      if (response.success) {
        toast.success(isCurrentUser ? 'You are now on break' : 'Employee is now on break');

        // Update with response data
        setEmployees(prevEmployees =>
          prevEmployees.map(emp =>
            (emp.id === employeeId || emp._id === employeeId)
              ? { ...emp, status: 'on_break' }
              : emp
          )
        );

        // Trigger refresh for UserDashboard and AdminDashboard
        triggerClockRefresh({
          action: isCurrentUser ? 'START_BREAK' : 'ADMIN_START_BREAK',
          employeeId: employeeId,
          employeeName: employee?.firstName && employee?.lastName
            ? `${employee.firstName} ${employee.lastName}`
            : 'Employee',
          timestamp: Date.now()
        });

        // Wait before fetching fresh data
        setTimeout(async () => {
          await fetchData();
          await fetchMyStatus();
        }, 1000);
      } else {
        toast.error(response.message || 'Failed to set on break');
        await fetchData(); // Revert on failure
      }
    } catch (error) {
      console.error('❌ Set on break error:', error);
      console.error('Error details:', error.response?.data);
      toast.error(error.response?.data?.message || error.message || 'Failed to set on break');
      await fetchData(); // Revert on error
    }
  };

  const handleStatusChange = async (employeeId, newStatus) => {
    if (!employeeId) {
      toast.error('Invalid employee ID');
      return;
    }

    // Optimistic update - update UI immediately
    const actualStatus = newStatus === 'resume_work' ? 'clocked_in' : newStatus;
    setEmployees(prevEmployees =>
      prevEmployees.map(emp =>
        (emp.id === employeeId || emp._id === employeeId)
          ? { ...emp, status: actualStatus }
          : emp
      )
    );

    // Also update selected employee if it matches
    setSelectedEmployee(prev =>
      prev && (prev.id === employeeId || prev._id === employeeId)
        ? { ...prev, status: actualStatus }
        : prev
    );

    try {
      const response = await changeEmployeeStatus(employeeId, actualStatus);
      if (response.success) {
        const displayStatus = newStatus === 'resume_work' ? 'resumed work' : actualStatus.replace('_', ' ');
        toast.success(`Status changed to ${displayStatus} successfully`);

        // Trigger refresh for UserDashboard and AdminDashboard
        const employee = employees.find(emp => emp.id === employeeId || emp._id === employeeId);
        triggerClockRefresh({
          action: newStatus === 'resume_work' ? 'RESUME_WORK' : 'STATUS_CHANGE',
          employeeId: employeeId,
          employeeName: employee?.firstName && employee?.lastName
            ? `${employee.firstName} ${employee.lastName}`
            : 'Employee',
          newStatus: actualStatus,
          timestamp: Date.now()
        });

        // Fetch fresh data to ensure consistency
        await fetchData();
        await fetchMyStatus();
      } else {
        toast.error(response.message || 'Failed to change status');
        // Revert optimistic update on failure
        await fetchData();
      }
    } catch (error) {
      console.error('Status change error:', error);
      toast.error(error.message || 'Failed to change status');
      // Revert optimistic update on error
      await fetchData();
    }
  };

  const handleDeleteTimeEntry = async () => {
    if (!entryToDelete.id) {
      toast.error('No time entry to delete');
      return;
    }

    try {
      const response = await deleteTimeEntry(entryToDelete.id);
      if (response.success) {
        toast.success('Time entry deleted successfully');
        // Force immediate refresh
        await fetchData();
        // Clear any selected employee
        setSelectedEmployee(null);
      } else {
        toast.error(response.message || 'Failed to delete time entry');
        // Still refresh to sync with backend
        await fetchData();
      }
    } catch (error) {
      console.error('Delete time entry error:', error);
      toast.error(error.message || 'Failed to delete time entry');
      // Refresh even on error to sync state
      await fetchData();
    }
  };

  const handleEditEntry = (employee) => {
    console.log('🔍 Edit Entry - Employee:', {
      id: employee.id,
      _id: employee._id,
      timeEntryId: employee.timeEntryId,
      fullObject: employee
    });

    if (!employee.timeEntryId) {
      toast.error('No time entry to edit. Employee must be clocked in first.');
      return;
    }

    setEditingEntry(employee);
    setEditForm({
      date: new Date().toISOString().split('T')[0],
      clockIn: employee.clockIn || '09:00',
      clockOut: employee.clockOut || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateTimeEntry = async (e) => {
    e.preventDefault();

    if (!editingEntry?.timeEntryId) return;

    try {
      const { updateTimeEntry } = await import('../utils/clockApi');
      const response = await updateTimeEntry(editingEntry.timeEntryId, {
        clockIn: editForm.clockIn,
        clockOut: editForm.clockOut,
        date: editForm.date
      });

      if (response.success) {
        toast.success('Time entry updated successfully');
        setShowEditModal(false);
        fetchData();
      } else {
        toast.error(response.message || 'Failed to update');
      }
    } catch (error) {
      console.error('Update error:', error);
      toast.error(error.response?.data?.message || 'Failed to update time entry');
    }
  };

  /**
   * Get current UK time for "Last Updated"
   */
  const getCurrentUKTime = () => {
    const now = new Date();
    return now.toLocaleString("en-GB", {
      timeZone: "Europe/London",
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
  };

  const getStatusBadge = (status, employee) => {
    // Determine if we should show 'None' instead of 'Absent'
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If status is absent, check if it's a future date or if shift hasn't ended yet
    let displayStatus = status;
    if (status === 'absent' || !status) {
      // For absent status, we need to determine if it should be 'None' or 'Absent'
      // Show 'None' if: no shift assigned yet OR current time hasn't reached end of day
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // If current time hasn't reached end of day, show 'None'
      // Once end of day is reached, show 'Absent'
      if (now < endOfDay) {
        displayStatus = 'none';
      } else {
        displayStatus = 'absent';
      }
    }

    const styles = {
      clocked_in: { color: '#10b981' },
      clocked_out: { color: '#3b82f6' },
      on_break: { color: '#f59e0b' },
      absent: { color: '#ef4444' },
      on_leave: { color: '#8b5cf6' },
      none: { color: '#9ca3af' }
    };

    const labels = {
      clocked_in: 'Clocked In',
      clocked_out: 'Clocked Out',
      on_break: 'On Break',
      absent: 'Absent',
      on_leave: 'On Leave',
      none: 'None'
    };

    return (
      <span style={{
        ...styles[displayStatus] || styles.none,
        fontSize: '13px',
        fontWeight: '500'
      }}>
        {labels[displayStatus] || 'Unknown'}
      </span>
    );
  };

  // Apply status filter first, then other filters
  const filteredEmployees = employees
    .filter(employee => {
      // Status filter
      if (statusFilter) {
        // Only show employees with matching status (exclude null/undefined)
        if (!employee.status || employee.status !== statusFilter) return false;
      }
      return true;
    })
    .filter(employee => {
      const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
        employee.employeeId?.toString().includes(searchTerm) ||
        employee.email?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedEmployees = filteredEmployees.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, filters]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Scroll to top of table
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page
      pages.push(1);

      // Calculate range around current page
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      // Add ellipsis if needed
      if (start > 2) {
        pages.push('ellipsis-start');
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis if needed
      if (end < totalPages - 1) {
        pages.push('ellipsis-end');
      }

      // Show last page
      pages.push(totalPages);
    }

    return pages;
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      <div style={{
        padding: '24px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#111827',
              marginBottom: '8px'
            }}>
              Clock-ins
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#6b7280'
            }}>
              Last Updated: {getCurrentUKTime()} (UK Time)
            </p>
          </div>

          {/* Top Action Buttons - Always Visible */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Searchable Employee Input with Clear Button */}
            <div className="employee-search-container" style={{ position: 'relative', minWidth: '300px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search employee to clock in..."
                  value={employeeSearchTerm}
                  onChange={(e) => {
                    setEmployeeSearchTerm(e.target.value);
                    setShowEmployeeDropdown(true);
                    if (!e.target.value) {
                      setSelectedEmployee(null);
                      setSelectedFromSearch(false);
                    }
                  }}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 16px',
                    border: '2px solid #3b82f6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    outline: 'none'
                  }}
                />
                {employeeSearchTerm && (
                  <button
                    onClick={() => {
                      setEmployeeSearchTerm('');
                      setSelectedEmployee(null);
                      setSelectedFromSearch(false);
                      setShowEmployeeDropdown(false);
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#6b7280'
                    }}
                  >
                    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {showEmployeeDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  zIndex: 1000
                }}>
                  {employees
                    .filter(emp => {
                      if (!employeeSearchTerm) return true; // Show all if no search term
                      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
                      const search = employeeSearchTerm.toLowerCase();
                      return fullName.includes(search) ||
                        emp.email?.toLowerCase().includes(search) ||
                        emp.vtid?.toString().includes(search);
                    })
                    .slice(0, 15)
                    .map(emp => (
                      <div
                        key={emp.id || emp._id}
                        onClick={() => {
                          console.log('🎯 Selected employee from dropdown:', {
                            id: emp.id,
                            _id: emp._id,
                            firstName: emp.firstName,
                            lastName: emp.lastName,
                            fullObject: emp
                          });
                          setSelectedEmployee(emp);
                          setEmployeeSearchTerm(`${emp.firstName} ${emp.lastName}`);
                          setShowEmployeeDropdown(false);
                          setSelectedFromSearch(true); // Mark as selected from search
                        }}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f3f4f6',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                      >
                        <div style={{ fontWeight: '500', fontSize: '14px', color: '#111827' }}>
                          {emp.firstName} {emp.lastName}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {emp.email} • {emp.vtid || 'No VTID'}
                        </div>
                      </div>
                    ))}
                  {employeeSearchTerm && employees.filter(emp => {
                    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
                    const search = employeeSearchTerm.toLowerCase();
                    return fullName.includes(search) ||
                      emp.email?.toLowerCase().includes(search) ||
                      emp.vtid?.toString().includes(search);
                  }).length === 0 && (
                      <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: '#6b7280',
                        fontSize: '14px'
                      }}>
                        No employees found
                      </div>
                    )}
                  {!employeeSearchTerm && employees.length === 0 && (
                    <div style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#6b7280',
                      fontSize: '14px'
                    }}>
                      No employees available
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedEmployee && selectedEmployee.status === 'clocked_in' && (
              <button
                onClick={() => handleOnBreak(selectedEmployee.id || selectedEmployee._id)}
                style={{
                  padding: '10px 24px',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)'
                }}
              >
                Add Break
              </button>
            )}

            {selectedFromSearch && selectedEmployee?.status === 'clocked_in' || selectedEmployee?.status === 'on_break' ? (
              <button
                onClick={() => handleClockOut(selectedEmployee.id || selectedEmployee._id)}
                style={{
                  padding: '10px 24px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                }}
              >
                Clock Out
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!selectedFromSearch) {
                    toast.warning('Please use the search bar above to select an employee for clock-in');
                    return;
                  }
                  console.log('🔘 Clock In button clicked. Selected employee:', {
                    id: selectedEmployee?.id,
                    _id: selectedEmployee?._id,
                    firstName: selectedEmployee?.firstName,
                    lastName: selectedEmployee?.lastName,
                    fullObject: selectedEmployee
                  });
                  if (selectedEmployee) {
                    openClockInModal(selectedEmployee);
                  } else {
                    toast.warning('Please select an employee from the search bar');
                  }
                }}
                disabled={!selectedFromSearch || !selectedEmployee}
                style={{
                  padding: '10px 24px',
                  background: (selectedFromSearch && selectedEmployee) ? '#10b981' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: (selectedFromSearch && selectedEmployee) ? 'pointer' : 'not-allowed',
                  boxShadow: (selectedFromSearch && selectedEmployee) ? '0 2px 4px rgba(16, 185, 129, 0.3)' : 'none'
                }}
              >
                Clock In
              </button>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 #f1f5f9'
        }}>
          {/* All Profiles Card */}
          <div
            onClick={() => {
              setStatusFilter(null);
              setSearchTerm('');
            }}
            style={{
              background: statusFilter === null ? '#f3f4f6' : '#ffffff',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              border: statusFilter === null ? '2px solid #6b7280' : '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '140px',
              flex: '0 0 auto'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#6b7280' }}>
              {statsLoading ? '...' : (stats?.total ?? employees.length)}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>All Employees</div>
          </div>
          <div
            onClick={() => setStatusFilter(statusFilter === 'clocked_in' ? null : 'clocked_in')}
            style={{
              background: statusFilter === 'clocked_in' ? '#d1fae5' : '#ffffff',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              border: statusFilter === 'clocked_in' ? '2px solid #10b981' : '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '140px',
              flex: '0 0 auto'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
              {statsLoading ? '...' : (stats?.clockedIn ?? 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Clocked In</div>
          </div>
          <div
            onClick={() => setStatusFilter(statusFilter === 'clocked_out' ? null : 'clocked_out')}
            style={{
              background: statusFilter === 'clocked_out' ? '#dbeafe' : '#ffffff',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              border: statusFilter === 'clocked_out' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '140px',
              flex: '0 0 auto'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
              {statsLoading ? '...' : (stats?.clockedOut ?? 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Clocked Out</div>
          </div>
          <div
            onClick={() => setStatusFilter(statusFilter === 'on_break' ? null : 'on_break')}
            style={{
              background: statusFilter === 'on_break' ? '#fef3c7' : '#ffffff',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              border: statusFilter === 'on_break' ? '2px solid #f59e0b' : '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '140px',
              flex: '0 0 auto'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
              {statsLoading ? '...' : (stats?.onBreak ?? 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>On a break</div>
          </div>
          <div
            onClick={() => setStatusFilter(statusFilter === 'absent' ? null : 'absent')}
            style={{
              background: statusFilter === 'absent' ? '#fee2e2' : '#ffffff',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              border: statusFilter === 'absent' ? '2px solid #ef4444' : '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '140px',
              flex: '0 0 auto'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
              {statsLoading ? '...' : (stats?.absent ?? 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Absent</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <input
                type="text"
                placeholder="Search by name, VTID or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                10 entries per page
              </span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <button
              onClick={() => {
                setFilters({
                  role: 'All Roles',
                  staffType: 'All Staff Types',
                  company: 'All Companies',
                  manager: 'All Managers'
                });
                setSearchTerm('');
                setStatusFilter(null);
              }}
              style={{
                padding: '8px 16px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Clear All Filters
            </button>
          </div>
        </div>

        {/* Employee Table */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead style={{
              background: '#f9fafb'
            }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb', width: '60px' }}>SI No.</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Employee ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Job Title</th>

                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Office</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Clock In</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Clock Out</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Break</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedEmployees.length > 0 ? (
                displayedEmployees.map((employee, index) => (
                  <tr
                    key={employee.id || employee._id || index}
                    onClick={() => {
                      console.log('🔍 Opening timesheet for employee:', {
                        id: employee.id,
                        _id: employee._id,
                        firstName: employee.firstName,
                        lastName: employee.lastName,
                        email: employee.email,
                        status: employee.status,
                        timeEntryId: employee.timeEntryId,
                        fullEmployee: employee
                      });
                      setSelectedEmployee(employee);
                      setShowTimesheetModal(true);
                    }}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      background: selectedEmployee?.id === employee.id ? '#f0f9ff' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedEmployee?.id !== employee.id) {
                        e.currentTarget.style.background = '#f9fafb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedEmployee?.id !== employee.id) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827', fontWeight: '600' }}>
                      {startIndex + index + 1}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      {employee.employeeId || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {`${employee.firstName || ''} ${employee.lastName || ''}`.trim() || '-'}
                        {currentUser?.email === employee.email && (
                          <span style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                            color: '#ffffff',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            letterSpacing: '0.5px'
                          }}>
                            ME
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      {employee.email || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      {employee.jobTitle || '-'}
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      {employee.office || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      {formatUKTimeOnly(employee.clockIn)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      {formatUKTimeOnly(employee.clockOut)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      {employee.breakIn && employee.breakOut ?
                        `${formatUKTimeOnly(employee.breakIn)} - ${formatUKTimeOnly(employee.breakOut)}` :
                        employee.breakIn ? `${formatUKTimeOnly(employee.breakIn)} (on break)` : '-'
                      }
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {getStatusBadge(employee.status || 'absent', employee)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                        {/* Clock In Button - Show when not clocked in */}
                        {(employee.status === 'absent' || employee.status === 'clocked_out' || !employee.status) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openClockInModal(employee);
                            }}
                            style={{
                              padding: '6px 16px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '500',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Clock In
                          </button>
                        )}

                        {/* Clock Out Button - Show when clocked in or on break */}
                        {(employee.status === 'clocked_in' || employee.status === 'on_break') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClockOut(employee.id || employee._id);
                            }}
                            style={{
                              padding: '6px 16px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '500',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Clock Out
                          </button>
                        )}

                        {/* Break Button - Show when clocked in */}
                        {employee.status === 'clocked_in' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOnBreak(employee.id || employee._id);
                            }}
                            style={{
                              padding: '6px 16px',
                              background: '#f59e0b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '500',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Break
                          </button>
                        )}

                        {/* View Details Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployee(employee);
                            setShowTimesheetModal(true);
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#ffffff',
                            color: '#3b82f6',
                            border: '1px solid #3b82f6',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                          title="View timesheet details"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#6b7280'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                      No Employees Found
                    </h3>
                    <p style={{ fontSize: '14px', color: '#6b7280' }}>
                      {searchTerm ? 'Try adjusting your search criteria' : 'No employees in the system'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredEmployees.length > 0 && totalPages > 1 && (
          <div style={{ marginTop: '24px' }}>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  />
                </PaginationItem>

                {getPageNumbers().map((pageNum, index) => {
                  if (typeof pageNum === 'string' && pageNum.startsWith('ellipsis')) {
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => handlePageChange(pageNum)}
                        isActive={pageNum === currentPage}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>

            {/* Pagination Info */}
            <div style={{
              marginTop: '16px',
              fontSize: '14px',
              color: '#6b7280',
              textAlign: 'center'
            }}>
              Showing {startIndex + 1} to {Math.min(endIndex, filteredEmployees.length)} of {filteredEmployees.length} entries
            </div>
          </div>
        )}
      </div>

      {/* Edit Time Entry Modal */}
      {showEditModal && editingEntry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '32px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'visible', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '24px' }}>
              Edit Time Entry - {editingEntry.firstName} {editingEntry.lastName}
            </h2>
            <form onSubmit={handleUpdateTimeEntry}>
              <div style={{ marginBottom: '24px' }}>
                <DatePicker
                  label="Date"
                  required
                  value={editForm.date || null}
                  onChange={(date) => setEditForm({ ...editForm, date: date ? date.format('YYYY-MM-DD') : '' })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                <div>
                  <MUITimePicker
                    label="Clock In Time"
                    value={editForm.clockIn}
                    onChange={(time) => setEditForm({ ...editForm, clockIn: time ? time.format('HH:mm') : '' })}
                    required
                  />
                </div>
                <div>
                  <MUITimePicker
                    label="Clock Out Time"
                    value={editForm.clockOut}
                    onChange={(time) => setEditForm({ ...editForm, clockOut: time ? time.format('HH:mm') : '' })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.target.style.background = '#ffffff'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '12px 28px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#ffffff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)' }}
                  onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                  onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern Clock-In Modal */}
      {showClockInModal && clockInEmployee && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '0',
            maxWidth: '520px',
            width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Header Image Section */}
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              padding: '48px 32px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Grid Pattern Background */}
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `
                  linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px',
                opacity: 0.3
              }}></div>

              {/* Placeholder for Image - Will be replaced */}
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '200px'
              }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '16px',
                  padding: '32px',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '36px',
                    color: 'white',
                    fontWeight: 'bold',
                    boxShadow: '0 8px 16px rgba(59, 130, 246, 0.4)'
                  }}>
                    {clockInEmployee.firstName?.[0]}{clockInEmployee.lastName?.[0]}
                  </div>
                  <div style={{
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '4px'
                    }}>
                      {clockInEmployee.firstName} {clockInEmployee.lastName}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#64748b',
                      fontWeight: '500'
                    }}>
                      {clockInEmployee.department || 'Employee'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div style={{ padding: '32px' }}>
              <h2 style={{
                fontSize: '28px',
                fontWeight: '700',
                color: '#111827',
                marginBottom: '12px',
                textAlign: 'center'
              }}>
                Clock In Confirmation
              </h2>
              <p style={{
                fontSize: '15px',
                color: '#6b7280',
                textAlign: 'center',
                lineHeight: '1.6',
                marginBottom: '32px'
              }}>
                You are about to clock in <strong style={{ color: '#111827' }}>{clockInEmployee.firstName} {clockInEmployee.lastName}</strong>.
                <br />
                This action will be recorded with a timestamp.
              </p>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => setShowClockInModal(false)}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    borderRadius: '12px',
                    border: '2px solid #e5e7eb',
                    background: '#ffffff',
                    color: '#374151',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#f9fafb';
                    e.target.style.borderColor = '#d1d5db';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#ffffff';
                    e.target.style.borderColor = '#e5e7eb';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClockIn}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                  }}
                >
                  Confirm Clock In
                </button>
              </div>

              {/* Geolocation Section - Shown after successful clock in */}
              {clockInGeoLocation && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '16px',
                  marginTop: '24px'
                }}>
                  <h3 style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#166534',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    📍 Location Captured
                  </h3>
                  <div style={{ fontSize: '13px', color: '#166534', lineHeight: '1.8' }}>
                    <div><strong>Coordinates:</strong> {clockInGeoLocation.latitude.toFixed(6)}, {clockInGeoLocation.longitude.toFixed(6)}</div>
                    <div><strong>Accuracy:</strong> ±{Math.round(clockInGeoLocation.accuracy)}m</div>
                    <div><strong>Time:</strong> {clockInGeoLocation.timestamp}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Employee Timesheet Modal */}
      {selectedEmployee && showTimesheetModal && (
        <EmployeeTimesheetModal
          employee={selectedEmployee}
          onClose={() => {
            setSelectedEmployee(null);
            setShowTimesheetModal(false);
          }}
        />
      )}

      {/* Delete Time Entry Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Time Entry"
        description={`Are you sure you want to delete the time entry for ${entryToDelete.name}?\n\nThis will:\n- Delete the clock-in/out record\n- Reset the shift status to "Scheduled"\n\nThis action cannot be undone.`}
        onConfirm={handleDeleteTimeEntry}
        confirmText="Delete Entry"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
};

export default ClockIns;
