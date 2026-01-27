// src/pages/UserDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useClockStatus } from '../context/ClockStatusContext';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Cookies from 'js-cookie';
import axios from 'axios';
import UserClockIns from './UserClockIns';
import MyShifts from '../components/MyShifts';
import Documents from './Documents';
import LeaveRequestCard from '../components/LeaveManagement/LeaveRequestCard';
import EmployeeCalendarView from '../components/EmployeeCalendarView';
import MyProfile from './MyProfile';
import { userClockIn, userClockOut, getUserClockStatus, userStartBreak, userResumeWork } from '../utils/clockApi';
import ShiftInfoCard from '../components/ShiftInfoCard';
import UserNavigation from '../components/UserNavigation';
import EmployeeMap from '../components/employeeLiveMap';
import { jobRoleCertificateMapping } from '../data/new';
import Expenses from './Expenses';
import PerformanceTab from '../components/Performance/PerformanceTab';
import DocumentViewer from '../components/DocumentManagement/DocumentViewer';
import {
  PencilIcon,
  PlusIcon,
  EyeIcon,
  BellIcon,
  UserCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CalendarIcon,
  ArrowUpTrayIcon as Upload
} from '@heroicons/react/24/outline';
import ConfirmDialog from '../components/ConfirmDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { formatDateDDMMYY } from '../utils/dateFormatter';
import { buildApiUrl, buildDirectUrl } from '../utils/apiConfig';

const UserDashboard = () => {
  const { user, logout } = useAuth();
  const { triggerClockRefresh } = useClockStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Check if user is an employee (full features) or profile (certificate-only)
  const [isEmployeeUser, setIsEmployeeUser] = useState(user?.userType === 'employee');

  // DEBUG: Log user type and role
  console.log('DEBUG: UserDashboard - User type:', user?.userType);
  console.log('DEBUG: UserDashboard - User role:', user?.role);
  console.log('DEBUG: UserDashboard - isEmployeeUser:', isEmployeeUser);
  // Default tab - employees always see overview, profiles see notifications
  const defaultTab = isEmployeeUser ? 'overview' : 'notifications';
  const initialTab = searchParams.get('tab') || defaultTab;

  const [userProfile, setUserProfile] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});

  const [clockStatus, setClockStatus] = useState(null);
  const [clockStatusLoading, setClockStatusLoading] = useState(true);
  const [workLocation, setWorkLocation] = useState('Work From Office');
  const [workType, setWorkType] = useState('Regular');
  const [processing, setProcessing] = useState(false);
  const [shiftInfo, setShiftInfo] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showClockOutDialog, setShowClockOutDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);

  // Overtime state
  const [overtimeRecords, setOvertimeRecords] = useState([]);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeForm, setOvertimeForm] = useState({
    date: new Date().toISOString().split('T')[0],
    scheduledHours: '',
    workedHours: '',
    notes: ''
  });

  // GPS location state
  const [gpsCoordinates, setGpsCoordinates] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [gpsError, setGpsError] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5003';

  // Handle tab change and update URL
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Sync activeTab with URL on mount and when URL changes
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isEmployeeUser && activeTab !== 'notifications') {
      setActiveTab('notifications');
      setSearchParams({ tab: 'notifications' });
    }
  }, [isEmployeeUser]);

  const fetchUserData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const employeeEndpoint = buildApiUrl(`/employees/by-email/${user.email}`);
      const profileEndpoint = buildApiUrl(`/profiles/by-email/${user.email}`);

      let resolvedIsEmployeeUser = isEmployeeUser;

      let userDataResponse = await fetch(employeeEndpoint, {
        credentials: 'include'
      });

      if (!userDataResponse.ok) {
        // Only treat as a profile user when employee record truly doesn't exist
        if (userDataResponse.status === 404) {
          resolvedIsEmployeeUser = false;
          userDataResponse = await fetch(profileEndpoint, {
            credentials: 'include'
          });
        }
      }

      if (userDataResponse.ok) {
        const userData = await userDataResponse.json();
        setIsEmployeeUser(resolvedIsEmployeeUser);
        setUserProfile(userData);
        setEditedProfile(userData);

        // Fetch certificates for both employee and profile users
        if (userData._id) {
          let certificatesResponse;
          
          if (resolvedIsEmployeeUser) {
            // For employees, use employeeRef endpoint
            certificatesResponse = await fetch(buildApiUrl(`/certificates/employee/${userData._id}`), {
              credentials: 'include'
            });
          } else {
            // For profiles, use profileRef endpoint  
            certificatesResponse = await fetch(buildApiUrl(`/profiles/${userData._id}/certificates`), {
              credentials: 'include'
            });
          }

          if (certificatesResponse.ok) {
            const certificatesData = await certificatesResponse.json();
            setCertificates(certificatesData);
          } else {
            console.warn('Failed to fetch certificates:', certificatesResponse.status);
            setCertificates([]);
          }
        } else {
          setCertificates([]);
        }

        // Fetch user notifications from session-based endpoint
        try {
          const token = localStorage.getItem('auth_token');
          const notificationsResponse = await fetch(buildApiUrl('/notifications?limit=10'), {
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (notificationsResponse.ok) {
            const notificationsData = await notificationsResponse.json();
            console.log('User notifications:', notificationsData);
            setNotifications(notificationsData.notifications || []); // Use notifications array from response
          } else if (notificationsResponse.status === 401) {
            console.warn('Notifications: Authentication required, skipping...');
            setNotifications([]);
          } else {
            console.error('Failed to fetch notifications:', notificationsResponse.status);
            setNotifications([]);
          }
        } catch (notifError) {
          console.error('Error fetching notifications:', notifError);
          setNotifications([]);
        }
      } else {
        console.error('Failed to fetch user data:', userDataResponse.status);
        if (userDataResponse.status === 404) {
          toast.error(`${isEmployeeUser ? 'Employee' : 'Profile'} not found. Please contact administrator.`);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load user data. Please try again.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [API_BASE_URL, user.email, isEmployeeUser]);

  // Fetch overtime records for employee
  const fetchOvertimeRecords = useCallback(async () => {
    if (!isEmployeeUser || !userProfile?._id) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl(`/overtime/employee/${userProfile._id}`), {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOvertimeRecords(data.overtimeRecords || []);
      } else {
        console.error('Failed to fetch overtime records:', response.status);
        setOvertimeRecords([]);
      }
    } catch (error) {
      console.error('Error fetching overtime records:', error);
      setOvertimeRecords([]);
    }
  }, [isEmployeeUser, userProfile]);

  // Handle overtime submission
  const handleOvertimeSubmit = async (e) => {
    e.preventDefault();
    
    if (!overtimeForm.scheduledHours || !overtimeForm.workedHours) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl('/overtime/create'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(overtimeForm)
      });

      if (response.ok) {
        toast.success('Overtime logged successfully');
        setShowOvertimeModal(false);
        setOvertimeForm({
          date: new Date().toISOString().split('T')[0],
          scheduledHours: '',
          workedHours: '',
          notes: ''
        });
        fetchOvertimeRecords();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to log overtime');
      }
    } catch (error) {
      console.error('Error logging overtime:', error);
      toast.error('Failed to log overtime');
    }
  };

  // Debug: Log clockStatus changes
  useEffect(() => {
    console.log('🎯 clockStatus state changed:', JSON.stringify(clockStatus, null, 2));
    console.log('🎯 clockStatusLoading:', clockStatusLoading);
  }, [clockStatus, clockStatusLoading]);

  // Restore clock-in state from cookies on page load
  useEffect(() => {
    // Only restore state if user is already authenticated (AuthContext handles validation)
    if (user?.email) {
      const savedClockStatus = Cookies.get('userClockedIn');
      const savedLocation = Cookies.get('clockInLocation');
      const savedWorkType = Cookies.get('clockInWorkType');

      if (savedClockStatus === 'true') {
        console.log('🍪 Restoring clock-in state from cookies');
        if (savedLocation) setWorkLocation(savedLocation);
        if (savedWorkType) setWorkType(savedWorkType);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user?.email) {
      fetchUserData();
      fetchClockStatus();
      captureCurrentLocation(); // Capture GPS on page load

      // Poll for updates every 60 seconds for notifications only (reduced frequency)
      const interval = setInterval(() => {
        fetchUserData(false); // Background refresh without loading screen
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [user, fetchUserData]);

  // Fetch overtime records when userProfile is loaded
  useEffect(() => {
    if (isEmployeeUser && userProfile?._id) {
      fetchOvertimeRecords();
    }
  }, [isEmployeeUser, userProfile, fetchOvertimeRecords]);

  // Capture current GPS location for map display
  const captureCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsCoordinates({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLocationAccuracy(position.coords.accuracy);
          console.log('📍 User dashboard GPS captured:', position.coords);
        },
        (error) => {
          console.warn('⚠️ GPS capture failed for user dashboard:', error);
          setGpsError(null); // Don't show error, just leave map empty
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // Cache for 5 minutes
        }
      );
    }
  };

  const fetchClockStatus = async () => {
    try {
      setClockStatusLoading(true);
      const response = await getUserClockStatus();
      console.log('📊 Clock status response:', JSON.stringify(response, null, 2));
      if (response.success && response.data) {
        console.log('✅ Setting clock status:', JSON.stringify({
          status: response.data.status,
          clockIn: response.data.clockIn,
          clockOut: response.data.clockOut,
          location: response.data.location,
          workType: response.data.workType
        }, null, 2));

        // Always set fresh data from backend
        const newStatus = {
          status: response.data.status,
          clockIn: response.data.clockIn,
          clockOut: response.data.clockOut,
          location: response.data.location,
          workType: response.data.workType,
          breaks: response.data.breaks
        };

        console.log('🔄 Current clockStatus before update:', clockStatus);
        setClockStatus(newStatus);
        console.log('🔄 New clockStatus set to:', newStatus);

        // Force a re-render check
        console.log('🔍 Status check - Should show Clock Out?', newStatus.status === 'clocked_in' || newStatus.status === 'on_break');
      } else {
        console.log('⚠️ No clock status data or unsuccessful response');
        setClockStatus(null);
      }
    } catch (error) {
      console.error('❌ Fetch clock status error:', error);
      setClockStatus(null);
    } finally {
      setClockStatusLoading(false);
    }
  };


  const initiateClockIn = () => {
    if (!workLocation) {
      toast.warning('Please select a location');
      return;
    }
    setPendingAction('clockIn');
    setShowLocationDialog(true);
  };

  const handleClockIn = async () => {
    setProcessing(true);
    setGpsError(null);

    try {
      // ========== GPS LOCATION CAPTURE ==========
      // Request GPS coordinates using browser's Geolocation API
      let gpsData = {};

      if (navigator.geolocation) {
        try {
          // Show loading toast while getting location
          const locationToast = toast.info('Requesting high-accuracy location...', { autoClose: false });

          // Function to get position with retry logic for better accuracy
          const getAccuratePosition = async (maxRetries = 3, targetAccuracy = 10) => {
            let bestPosition = null;
            let bestAccuracy = Infinity;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                console.log(`📍 GPS attempt ${attempt}/${maxRetries}, target accuracy: ${targetAccuracy}m`);

                const position = await new Promise((resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    {
                      enableHighAccuracy: true, // Request high accuracy GPS
                      timeout: 15000, // 15 second timeout per attempt
                      maximumAge: 0 // Don't use cached position
                    }
                  );
                });

                const accuracy = position.coords.accuracy;
                console.log(`📍 GPS attempt ${attempt} accuracy: ${accuracy.toFixed(2)}m`);

                // Keep track of best position
                if (accuracy < bestAccuracy) {
                  bestPosition = position;
                  bestAccuracy = accuracy;
                }

                // If we achieved target accuracy, use it immediately
                if (accuracy <= targetAccuracy) {
                  console.log(`✅ Achieved target accuracy of ${targetAccuracy}m on attempt ${attempt}`);
                  return position;
                }

                // Wait a bit before next attempt to allow GPS to stabilize
                if (attempt < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              } catch (error) {
                console.warn(`⚠️ GPS attempt ${attempt} failed:`, error.message);
                if (attempt === maxRetries && !bestPosition) {
                  throw error; // Throw only if all attempts failed
                }
              }
            }

            // Return best position if target accuracy wasn't achieved
            if (bestPosition) {
              console.log(`📍 Using best accuracy achieved: ${bestAccuracy.toFixed(2)}m`);
              return bestPosition;
            }

            throw new Error('Failed to get GPS location after all attempts');
          };

          // Get accurate position with retry logic
          const position = await getAccuratePosition(3, 10);

          // Extract GPS coordinates
          gpsData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };

          // Update state for display
          setGpsCoordinates({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLocationAccuracy(Math.round(position.coords.accuracy));

          // Dismiss location toast
          toast.dismiss(locationToast);

          // Show accuracy feedback based on GPS quality
          const accuracyMeters = Math.round(position.coords.accuracy);

          if (accuracyMeters <= 10) {
            toast.success(`✅ Excellent GPS accuracy: ${accuracyMeters}m`, {
              autoClose: 3000
            });
          } else if (accuracyMeters <= 50) {
            toast.info(`📍 Good GPS accuracy: ${accuracyMeters}m`, {
              autoClose: 4000
            });
          } else if (accuracyMeters <= 100) {
            toast.warning(`⚠️ Moderate GPS accuracy: ${accuracyMeters}m. Try moving closer to a window.`, {
              autoClose: 5000
            });
          } else if (accuracyMeters <= 1000) {
            toast.warning(`⚠️ Low GPS accuracy: ${accuracyMeters}m. Please enable GPS and move outdoors for better accuracy.`, {
              autoClose: 6000
            });
          } else {
            toast.error(`❌ Very poor GPS accuracy: ${(accuracyMeters / 1000).toFixed(1)}km. You may be indoors or GPS is disabled. Please enable location services and try outdoors.`, {
              autoClose: 8000
            });
          }

          console.log('GPS captured:', gpsData);
        } catch (gpsError) {
          console.error('GPS error:', gpsError);

          // Handle specific GPS errors
          if (gpsError.code === 1) {
            setGpsError('Location permission denied. Please enable location access.');
            toast.error('Location permission denied! Please enable location access in your browser settings.', {
              autoClose: 7000
            });
            setProcessing(false);
            return; // Stop clock-in if GPS is required
          } else if (gpsError.code === 2) {
            setGpsError('Location unavailable. Please check your device settings.');
            toast.warning('Location unavailable. Clocking in without GPS data.');
          } else if (gpsError.code === 3) {
            setGpsError('Location request timeout.');
            toast.warning('Location timeout. Clocking in without GPS data.');
          }

          // Continue with clock-in even if GPS fails (optional - can be made mandatory)
          console.warn('Continuing clock-in without GPS data');
        }
      } else {
        setGpsError('Geolocation not supported by browser');
        toast.warning('GPS not supported. Clocking in without location data.');
      }
      // ==========================================

      // Send clock-in request with GPS data
      const response = await userClockIn({
        location: workLocation,
        workType,
        ...gpsData // Spread GPS coordinates (latitude, longitude, accuracy)
      });

      if (response.success) {
        toast.success(response.message || 'Clocked in successfully!');

        // Set cookie to persist clock-in state (expires in 1 day)
        Cookies.set('userClockedIn', 'true', { expires: 1 });
        Cookies.set('clockInTime', new Date().toISOString(), { expires: 1 });
        Cookies.set('clockInLocation', workLocation, { expires: 1 });
        Cookies.set('clockInWorkType', workType, { expires: 1 });

        if (response.data) {
          setShiftInfo(response.data.shift);
          setAttendanceStatus(response.data.attendanceStatus);
        }

        // Fetch updated clock status to update UI immediately
        await fetchClockStatus();

        // Trigger refresh in admin dashboard and all other tabs for immediate update
        triggerClockRefresh({
          action: 'CLOCK_IN',
          userId: user?.id || user?.email,
          userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          location: workLocation,
          workType: workType,
          timestamp: Date.now()
        });

        if (response.data?.attendanceStatus === 'Late') {
          toast.warning('Late arrival detected', { autoClose: 5000 });
        }
      }
    } catch (error) {
      console.error('Clock in error:', error);
      // Extract error message from response (backend returns { success: false, message: '...' })
      const errorMessage = error.message || error.error || 'Failed to clock in';

      // Check if error response includes current status (from "already clocked in" error)
      if (error.currentStatus) {
        console.log('✅ Error includes current status, updating UI immediately:', error.currentStatus);
        setClockStatus({
          status: error.currentStatus.status,
          clockIn: error.currentStatus.clockIn,
          clockOut: error.currentStatus.clockOut,
          location: error.currentStatus.location,
          workType: error.currentStatus.workType,
          breaks: error.currentStatus.breaks
        });
        toast.warning('You are already clocked in', { autoClose: 3000 });
      } else {
        // Always refresh status when there's an error to sync UI with backend state
        console.log('⚠️ Clock-in failed, fetching current status to sync UI...');
        await fetchClockStatus();

        // If user is already clocked in, show appropriate message
        if (errorMessage.includes('already') || errorMessage.includes('clocked in')) {
          toast.warning('You are already clocked in', { autoClose: 3000 });
        } else {
          toast.error(errorMessage, { autoClose: 5000 });
        }
      }
    } finally {
      setProcessing(false);
    }
  };

  const initiateClockOut = () => {
    setPendingAction('clockOut');
    setShowClockOutDialog(true);
  };

  const handleClockOut = async () => {
    setProcessing(true);
    setGpsError(null);

    try {
      // ========== GPS LOCATION CAPTURE FOR CLOCK-OUT ==========
      let gpsData = {};

      if (navigator.geolocation) {
        try {
          console.log('📍 Capturing GPS location for clock-out...');
          const locationToast = toast.info('Capturing location for clock-out...', { autoClose: false });

          // Get accurate position for clock-out
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

      const response = await userClockOut(gpsData);

      if (response.success) {
        const hours = response.data?.hoursWorked || 0;
        toast.success(`Clocked out! Hours: ${hours.toFixed(2)}h`, { autoClose: 5000 });

        // Remove cookies to clear persisted clock-in state
        Cookies.remove('userClockedIn');
        Cookies.remove('clockInTime');
        Cookies.remove('clockInLocation');
        Cookies.remove('clockInWorkType');

        setShiftInfo(null);
        setAttendanceStatus(null);

        // Fetch updated clock status to update UI immediately
        await fetchClockStatus();

        // Trigger refresh in admin dashboard and all other tabs for immediate update
        triggerClockRefresh({
          action: 'CLOCK_OUT',
          userId: user?.id || user?.email,
          userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          hoursWorked: hours,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Clock out error:', error);
      // Refresh status to sync UI with backend state
      console.log('⚠️ Clock-out failed, fetching current status to sync UI...');
      await fetchClockStatus();
      toast.error(error.message || 'Failed to clock out');
    } finally {
      setProcessing(false);
    }
  };

  const handleStartBreak = async () => {
    setProcessing(true);
    try {
      const response = await userStartBreak();

      if (response.success) {
        toast.success('Break started');

        // Fetch updated clock status to update UI immediately
        await fetchClockStatus();

        // Trigger refresh in admin dashboard and all other tabs for immediate update
        triggerClockRefresh({
          action: 'START_BREAK',
          userId: user?.id || user?.email,
          userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Start break error:', error);
      toast.error(error.message || 'Failed to start break');
    } finally {
      setProcessing(false);
    }
  };

  const handleResumeWork = async () => {
    setProcessing(true);
    try {
      const response = await userResumeWork();

      if (response.success) {
        toast.success('Work resumed');

        // Fetch updated clock status to update UI immediately
        await fetchClockStatus();

        // Trigger refresh in admin dashboard and all other tabs for immediate update
        triggerClockRefresh({
          action: 'RESUME_WORK',
          userId: user?.id || user?.email,
          userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Resume work error:', error);
      toast.error(error.message || 'Failed to resume work');
    } finally {
      setProcessing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleProfileEdit = () => {
    setIsEditingProfile(true);
  };

  const handleProfileSave = async () => {
    try {
      // Determine which endpoint to use based on userType
      const endpoint = isEmployeeUser
        ? buildApiUrl(`/employees/${userProfile._id}`)
        : buildApiUrl(`/profiles/${userProfile._id}`);

      console.log('Updating user data at:', endpoint, 'userType:', user.userType);

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(editedProfile)
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setUserProfile(updatedProfile);
        setIsEditingProfile(false);
        toast.success('Profile updated successfully!');
        await fetchUserData(false); // Background refresh to get new notification
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Update failed:', response.status, errorData);
        toast.error(errorData.message || 'Failed to update profile. Please try again.');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Error updating profile. Please try again.');
    }
  };

  const handleProfileCancel = () => {
    setEditedProfile(userProfile);
    setIsEditingProfile(false);
  };

  const handleInputChange = (field, value) => {
    setEditedProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddCertificate = () => {
    navigate('/user/certificates/create?returnTab=certificates');
  };

  const handleViewCertificate = (certificateId) => {
    navigate(`/user/certificates/${certificateId}?returnTab=certificates`);
  };

  const getCertificateStatusColor = (expiryDate) => {
    if (!expiryDate) return 'text-gray-500';

    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) return 'text-red-600'; // Expired
    if (daysUntilExpiry <= 30) return 'text-yellow-600'; // Expiring soon
    return 'text-green-600'; // Valid
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'certificate_expiry':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'certificate_added':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'profile_updated':
        return <UserCircleIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <BellIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getRequiredCertificates = () => {
    if (!userProfile?.jobRole) return null;

    // Handle jobRole as array or string
    const jobRole = Array.isArray(userProfile.jobRole)
      ? userProfile.jobRole[0]
      : userProfile.jobRole;

    return jobRoleCertificateMapping[jobRole] || null;
  };

  const checkCertificateStatus = (certCode) => {
    // Check if user has this certificate
    return certificates.some(cert =>
      cert.certificate && cert.certificate.includes(certCode)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Navigation */}
      <UserNavigation
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        notifications={notifications}
        onLogout={handleLogout}
        user={user}
        isEmployeeUser={isEmployeeUser}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab - Only for Employee Users */}
        {activeTab === 'overview' && isEmployeeUser && (
          <div className="space-y-6">
            {/* Clock In/Out Widget */}
            <div className="bg-white shadow-md rounded-lg p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <ClockIcon className="h-6 w-6 mr-3 text-blue-600" />
                Time Tracking
              </h2>

              {shiftInfo && attendanceStatus && (
                <div className="mb-6">
                  <ShiftInfoCard shift={shiftInfo} attendanceStatus={attendanceStatus} validation={null} />
                </div>
              )}

              {/* GPS Location Accuracy Display */}
              {locationAccuracy && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                  <p className="text-sm text-blue-800 flex items-center justify-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <strong>Location accuracy:</strong>&nbsp;{locationAccuracy} meters
                  </p>
                </div>
              )}

              {/* Live Location Map */}
              {gpsCoordinates?.latitude && gpsCoordinates?.longitude && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">📍 Your Live Location</h3>
                  <EmployeeMap
                    latitude={gpsCoordinates.latitude}
                    longitude={gpsCoordinates.longitude}
                  />
                </div>
              )}

              {/* GPS Error Display */}
              {gpsError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <p className="text-sm text-red-800 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {gpsError}
                  </p>
                </div>
              )}

              {clockStatusLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-gray-600 mt-2">Loading clock status...</p>
                </div>
              ) : clockStatus?.status === 'clocked_in' || clockStatus?.status === 'on_break' ? (
                <div className="space-y-4">
                  <div className="text-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full font-semibold text-sm mb-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                      {clockStatus.status === 'on_break' ? 'On Break' : 'Currently Clocked In'}
                    </div>
                    {clockStatus.clockIn && (
                      <p className="text-gray-700 text-sm mt-2">
                        Clocked in at: <strong className="text-gray-900">{clockStatus.clockIn}</strong>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {clockStatus.status === 'on_break' ? (
                      <button
                        onClick={handleResumeWork}
                        disabled={processing}
                        className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        {processing ? 'Processing...' : 'Resume Work'}
                      </button>
                    ) : (
                      <button
                        onClick={handleStartBreak}
                        disabled={processing}
                        className="w-full px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        {processing ? 'Processing...' : 'Start Break'}
                      </button>
                    )}

                    <button
                      onClick={initiateClockOut}
                      disabled={processing}
                      className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      {processing ? 'Processing...' : 'Clock Out'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Location <span className="text-red-500">*</span>
                      </label>
                      <Select value={workLocation} onValueChange={setWorkLocation}>
                        <SelectTrigger className="w-full px-4 py-3">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Work From Office">Work From Office</SelectItem>
                          <SelectItem value="Work From Home">Work From Home</SelectItem>
                          <SelectItem value="Field">Field</SelectItem>
                          <SelectItem value="Client Side">Client Site</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Work Type
                      </label>
                      <Select value={workType} onValueChange={setWorkType}>
                        <SelectTrigger className="w-full px-4 py-3">
                          <SelectValue placeholder="Select work type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Regular">Regular</SelectItem>
                          <SelectItem value="Overtime">Overtime</SelectItem>
                          <SelectItem value="Weekend Overtime">Weekend Overtime</SelectItem>
                          <SelectItem value="Client-side Overtime">Client-side Overtime</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <button
                    onClick={initiateClockIn}
                    disabled={processing}
                    className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg text-lg"
                  >
                    {processing ? 'Processing...' : 'Clock In'}
                  </button>
                </div>
              )}
            </div>

            {/* My Documents Widget */}
            <div className="bg-white shadow-md rounded-lg p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <DocumentTextIcon className="h-6 w-6 mr-3 text-blue-600" />
                My Documents
              </h2>
              {console.log('🔍 Rendering MyDocumentsWidget with userId:', userProfile?._id || user?.id, 'userProfile._id:', userProfile?._id, 'user.id:', user?.id)}
              <MyDocumentsWidget userId={userProfile?._id || user?.id} />
            </div>

            {/* E-Learning Widget */}
            <div className="bg-white shadow-md rounded-lg p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <DocumentTextIcon className="h-6 w-6 mr-3 text-green-600" />
                E-Learning Materials
              </h2>
              <ELearningWidget />
            </div>

            {/* Quick Stats - Clickable Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              {/* Total Certificates Card */}
              <div>
                <button
                  onClick={() => setExpandedCard(expandedCard === 'certificates' ? null : 'certificates')}
                  className="w-full bg-white overflow-hidden shadow-md rounded-lg hover:shadow-lg transition-all hover:scale-105 cursor-pointer"
                >
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <div className="flex-shrink-0">
                          <DocumentTextIcon className="h-6 w-6 text-blue-500" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">Total Certificates</dt>
                            <dd className="text-lg font-semibold text-gray-900">{certificates.length}</dd>
                          </dl>
                        </div>
                      </div>
                      <svg className={`h-5 w-5 text-gray-400 transition-transform ${expandedCard === 'certificates' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>
                {expandedCard === 'certificates' && (
                  <div className="mt-2 bg-white shadow rounded-lg p-4 animate-fadeIn">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Your Certificates</h4>
                    {certificates.length === 0 ? (
                      <p className="text-sm text-gray-500">No certificates found</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {certificates.map((cert, idx) => {
                          const expiryDate = cert.expiryDate ? new Date(cert.expiryDate) : null;
                          const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
                          return (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{cert.title || cert.certificate || cert.certificateName}</p>
                                <p className="text-xs text-gray-500">{cert.category || 'General'}</p>
                              </div>
                              <div className="text-right">
                                {daysUntilExpiry === null ? (
                                  <span className="text-xs text-gray-500">No expiry</span>
                                ) : daysUntilExpiry < 0 ? (
                                  <span className="text-xs text-red-600 font-medium">Expired</span>
                                ) : daysUntilExpiry <= 30 ? (
                                  <span className="text-xs text-yellow-600 font-medium">{daysUntilExpiry}d left</span>
                                ) : (
                                  <span className="text-xs text-green-600 font-medium">Valid</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Expiring Soon Card */}
              <div>
                <button
                  onClick={() => setExpandedCard(expandedCard === 'expiring' ? null : 'expiring')}
                  className="w-full bg-white overflow-hidden shadow-md rounded-lg hover:shadow-lg transition-all hover:scale-105 cursor-pointer"
                >
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <div className="flex-shrink-0">
                          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">Expiring Soon</dt>
                            <dd className="text-lg font-semibold text-gray-900">
                              {certificates.filter(cert => {
                                if (!cert.expiryDate) return false;
                                const daysUntilExpiry = Math.ceil((new Date(cert.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                                return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                              }).length}
                            </dd>
                          </dl>
                        </div>
                      </div>
                      <svg className={`h-5 w-5 text-gray-400 transition-transform ${expandedCard === 'expiring' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>
                {expandedCard === 'expiring' && (
                  <div className="mt-2 bg-white shadow rounded-lg p-4 animate-fadeIn">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Certificates Expiring Within 30 Days</h4>
                    {certificates.filter(cert => {
                      if (!cert.expiryDate) return false;
                      const daysUntilExpiry = Math.ceil((new Date(cert.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                    }).length === 0 ? (
                      <p className="text-sm text-gray-500">No certificates expiring soon</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {certificates
                          .filter(cert => {
                            if (!cert.expiryDate) return false;
                            const daysUntilExpiry = Math.ceil((new Date(cert.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                            return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                          })
                          .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
                          .map((cert, idx) => {
                            const daysUntilExpiry = Math.ceil((new Date(cert.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                            return (
                              <div key={idx} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">{cert.certificate || cert.certificateName}</p>
                                  <p className="text-xs text-gray-600">Expires: {formatDateDDMMYY(cert.expiryDate)}</p>
                                </div>
                                <div className="text-right">
                                  <span className={`text-xs font-semibold px-2 py-1 rounded ${daysUntilExpiry <= 7 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                    {daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'} left
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notifications Card */}
              <div>
                <button
                  onClick={() => setExpandedCard(expandedCard === 'notifications' ? null : 'notifications')}
                  className="w-full bg-white overflow-hidden shadow-md rounded-lg hover:shadow-lg transition-all hover:scale-105 cursor-pointer"
                >
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <div className="flex-shrink-0">
                          <BellIcon className="h-6 w-6 text-blue-500" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">New Notifications</dt>
                            <dd className="text-lg font-semibold text-gray-900">{notifications.length}</dd>
                          </dl>
                        </div>
                      </div>
                      <svg className={`h-5 w-5 text-gray-400 transition-transform ${expandedCard === 'notifications' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>
                {expandedCard === 'notifications' && (
                  <div className="mt-2 bg-white shadow rounded-lg p-4 animate-fadeIn">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Notifications</h4>
                    {notifications.length === 0 ? (
                      <p className="text-sm text-gray-500">No new notifications</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {notifications.slice(0, 10).map((notification, idx) => (
                          <div key={idx} className="flex items-start space-x-3 p-2 bg-blue-50 rounded hover:bg-blue-100">
                            <div className="flex-shrink-0 mt-1">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{notification.title || 'Notification'}</p>
                              <p className="text-xs text-gray-600 truncate">{notification.message}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(notification.createdAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Overtime Card */}
              <div>
                <button
                  onClick={() => setExpandedCard(expandedCard === 'overtime' ? null : 'overtime')}
                  className="w-full bg-white overflow-hidden shadow-md rounded-lg hover:shadow-lg transition-all hover:scale-105 cursor-pointer"
                >
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <div className="flex-shrink-0">
                          <ClockIcon className="h-6 w-6 text-purple-500" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">Overtime Hours</dt>
                            <dd className="text-lg font-semibold text-gray-900">
                              {overtimeRecords.filter(o => o.approvalStatus === 'approved').reduce((sum, o) => sum + (o.overtimeHours || 0), 0).toFixed(1)}
                            </dd>
                          </dl>
                        </div>
                      </div>
                      <svg className={`h-5 w-5 text-gray-400 transition-transform ${expandedCard === 'overtime' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>
                {expandedCard === 'overtime' && (
                  <div className="mt-2 bg-white shadow rounded-lg p-4 animate-fadeIn">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">My Overtime</h4>
                      <button
                        onClick={() => setShowOvertimeModal(true)}
                        className="px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700"
                      >
                        Log Overtime
                      </button>
                    </div>
                    {overtimeRecords.length === 0 ? (
                      <p className="text-sm text-gray-500">No overtime records</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {overtimeRecords.slice(0, 5).map((record, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(record.date).toLocaleDateString('en-GB')} - {record.overtimeHours?.toFixed(1)}h
                              </p>
                              <p className="text-xs text-gray-500">{record.notes || 'No notes'}</p>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                record.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' :
                                record.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {record.approvalStatus}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Leave Request Section Removed */}

            {/* Recent Activity */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Activity</h3>
                {notifications.length === 0 ? (
                  <p className="text-gray-500">No recent activity</p>
                ) : (
                  <div className="space-y-3">
                    {notifications.slice(0, 5).map((notification, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{notification.message}</p>
                          <p className="text-xs text-gray-500">
                            {formatDateDDMMYY(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && isEmployeeUser && (
          <div className="space-y-6">
            <EmployeeCalendarView userProfile={userProfile} />
          </div>
        )}

        {/* Leave Tab */}
        {activeTab === 'leave' && isEmployeeUser && (
          <div className="space-y-6">
            <LeaveRequestCard />
            <LeaveStatusSection userId={user?._id || user?.id} />
          </div>
        )}

        {/* Profile Tab - Only for Employee Users */}
        {activeTab === 'profile' && isEmployeeUser && (
          <div style={{ margin: '-32px', padding: '0' }}>
            <MyProfile />
          </div>
        )}

        {/* Clock-ins Tab - Only for Employee Users */}
        {activeTab === 'clock-ins' && isEmployeeUser && (
          <div style={{ margin: '-32px', padding: '0' }}>
            <UserClockIns />
          </div>
        )}

        {/* Shifts/Calendar Tab - Only for Employee Users */}
        {activeTab === 'shifts' && isEmployeeUser && (
          <div style={{ margin: '-32px', padding: '0' }}>
            <MyShifts />
          </div>
        )}

        {/* Documents Tab - Only for Employee Users */}
        {activeTab === 'documents' && isEmployeeUser && (
          <div style={{ margin: '-32px', padding: '0' }}>
            <Documents embedded />
          </div>
        )}
        {/* Performance Tab */}
        {activeTab === 'performance' && isEmployeeUser && (
          <div style={{ margin: '-32px', padding: '0' }}>
            <PerformanceTab user={user} userProfile={userProfile} />
          </div>
        )}
        {/* Expenses Tab - render inside dashboard for employee users */}
        {activeTab === 'expenses' && isEmployeeUser && (
          <div style={{ margin: '-32px', padding: '0' }}>
            <Expenses />
          </div>
        )}

        {/* Certificates Tab */}
        {activeTab === 'certificates' && (
          <div className="space-y-6">
            {/* Required Certificates Section */}
            {getRequiredCertificates() && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">
                  Required Certificates for {Array.isArray(userProfile.jobRole) ? userProfile.jobRole[0] : userProfile.jobRole}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(getRequiredCertificates()).map(([category, certs]) => {
                    if (category === 'optional' || !Array.isArray(certs)) return null;
                    const categoryName = category.replace('mandatory', '').replace(/([A-Z])/g, ' $1').trim();
                    return (
                      <div key={category} className="bg-white rounded-lg p-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 mb-2 capitalize">{categoryName}</h4>
                        <ul className="space-y-1">
                          {certs.map(cert => (
                            <li key={cert} className="flex items-center text-sm">
                              {checkCertificateStatus(cert) ? (
                                <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                              ) : (
                                <ExclamationTriangleIcon className="h-4 w-4 text-red-500 mr-2" />
                              )}
                              <span className={checkCertificateStatus(cert) ? 'text-green-700' : 'text-red-700'}>
                                {cert}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                {getRequiredCertificates().optional && (
                  <div className="mt-4 bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="font-semibold text-gray-900 mb-2">Optional Certificates</h4>
                    <div className="flex flex-wrap gap-2">
                      {getRequiredCertificates().optional.map(cert => (
                        <span
                          key={cert}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${checkCertificateStatus(cert)
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {checkCertificateStatus(cert) && <CheckCircleIcon className="h-3 w-3 mr-1" />}
                          {cert}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    My Certificates ({certificates.length})
                  </h3>
                  <button
                    onClick={handleAddCertificate}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Certificate
                  </button>
                </div>

                {certificates.length === 0 ? (
                  <div className="text-center py-12">
                    <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No certificates</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by adding your first certificate.</p>
                    <div className="mt-6">
                      <button
                        onClick={handleAddCertificate}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Add Certificate
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Certificate
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Expiry Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {certificates.map((certificate) => {
                          const expiryDate = certificate.expiryDate ? new Date(certificate.expiryDate) : null;
                          const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)) : null;

                          return (
                            <tr key={certificate._id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {certificate.title || certificate.certificate || certificate.certificateName || 'Certificate'}
                                </div>
                                <div className="text-sm text-gray-500">{certificate.issuingOrganization || certificate.provider || 'N/A'}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {certificate.category || 'General'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${daysUntilExpiry === null ? 'bg-gray-100 text-gray-800' :
                                  daysUntilExpiry < 0 ? 'bg-red-100 text-red-800' :
                                    daysUntilExpiry <= 30 ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-green-100 text-green-800'
                                  }`}>
                                  {daysUntilExpiry === null ? 'No Expiry' :
                                    daysUntilExpiry < 0 ? 'Expired' :
                                      daysUntilExpiry <= 30 ? 'Expiring Soon' :
                                        'Valid'}
                                </span>
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm ${getCertificateStatusColor(certificate.expiryDate)}`}>
                                {certificate.expiryDate ? formatDateDDMMYY(certificate.expiryDate) : 'No expiry'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => handleViewCertificate(certificate._id)}
                                  className="text-blue-600 hover:text-blue-900 flex items-center"
                                >
                                  <EyeIcon className="h-4 w-4 mr-1" />
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">My Notifications</h3>

              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No notifications</h3>
                  <p className="mt-1 text-sm text-gray-500">You're all caught up! New notifications will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification, index) => (
                    <div key={index} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{notification.title || 'Notification'}</p>
                        <p className="text-sm text-gray-600">{notification.message}</p>
                        <div className="mt-2 flex items-center text-xs text-gray-500">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          {new Date(notification.createdAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Location Permission Dialog */}
      <ConfirmDialog
        open={showLocationDialog}
        onOpenChange={setShowLocationDialog}
        title="Location Access Required"
        description="We need to access your location to record your clock-in/out position. This helps verify your work location and ensures accurate attendance tracking. Do you want to allow location access?"
        onConfirm={() => {
          if (pendingAction === 'clockIn') {
            handleClockIn();
          }
        }}
        confirmText="Allow Location"
        cancelText="Cancel"
        variant="default"
      />

      {/* Clock Out Confirmation Dialog */}
      <ConfirmDialog
        open={showClockOutDialog}
        onOpenChange={setShowClockOutDialog}
        title="Clock Out Confirmation"
        description="Are you sure you want to clock out? This will end your current work session and capture your location."
        onConfirm={handleClockOut}
        confirmText="Clock Out"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Overtime Modal */}
      {showOvertimeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Log Overtime</h3>
              <button
                onClick={() => setShowOvertimeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleOvertimeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={overtimeForm.date}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={overtimeForm.scheduledHours}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, scheduledHours: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., 8"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Worked Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={overtimeForm.workedHours}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, workedHours: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., 10"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={overtimeForm.notes}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows="3"
                  placeholder="Reason for overtime..."
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  Submit
                </button>
                <button
                  type="button"
                  onClick={() => setShowOvertimeModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// My Documents Widget Component
const MyDocumentsWidget = ({ userId }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    if (userId) {
      fetchMyDocuments();
    }
  }, [userId]);

  const fetchMyDocuments = async () => {
    if (!userId) {
      console.log('⚠️ MyDocumentsWidget: userId is undefined, skipping fetch');
      setLoading(false);
      return;
    }
    
    console.log('📂 MyDocumentsWidget: Fetching documents for userId:', userId);
    
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const url = buildApiUrl(`/documentManagement/employees/${userId}/my-documents`);
      
      console.log('📂 Fetching from:', url);
      console.log('📂 Has token:', !!token);
      
      const response = await fetch(url, { 
        credentials: 'include',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ My Documents fetched:', data.documents?.length || 0, 'documents');
        setDocuments(data.documents || []);
      } else {
        console.error('❌ Failed to fetch documents:', response.status, response.statusText);
        setDocuments([]);
      }
    } catch (error) {
      console.error('❌ Error fetching My Documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!userId) {
      alert('Missing employee information. Please re-login and try again.');
      return;
    }
    if (!uploadFile) {
      alert('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('category', 'other');
      formData.append('ownerId', userId); // Set employee as document owner

      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        buildApiUrl('/documents/upload'),
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: formData
        }
      );

      if (response.ok) {
        alert('Document uploaded successfully!');
        setShowUploadModal(false);
        setUploadFile(null);
        fetchMyDocuments();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to upload document');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = (doc) => {
    setSelectedDocument(doc);
    setShowDocumentViewer(true);
  };

  const handleDownload = async (doc) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        buildApiUrl(`/documentManagement/documents/${doc._id}/download`),
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` })
          },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.name || doc.fileName || 'document');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-sm text-gray-600 mt-2">Loading documents...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div>
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
        <div className="text-center py-12">
          <DocumentTextIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents uploaded yet</h3>
          <p className="text-gray-600">Upload your documents or view documents shared by your administrator</p>
        </div>
        
        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Upload Document</h3>
              <input
                type="file"
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="w-full mb-4 p-2 border rounded"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={uploading || !uploadFile}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      </div>
      
      <div className="space-y-3">{documents.map((doc) => (
        <div
          key={doc._id}
          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-4 flex-1">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <DocumentTextIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">{doc.name}</h4>
              <div className="flex items-center space-x-3 text-sm text-gray-500 mt-1">
                <span>{formatFileSize(doc.fileSize)}</span>
                <span>•</span>
                <span>{formatDateDDMMYY(doc.createdAt)}</span>
                {doc.category && doc.category !== 'other' && (
                  <>
                    <span>•</span>
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs capitalize">
                      {doc.category.replace('_', ' ')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <button
              onClick={() => handleViewDocument(doc)}
              className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
              title="View document"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={() => handleDownload(doc)}
              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              title="Download document"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
      ))}
      </div>
      
      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Upload Document</h3>
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="w-full mb-4 p-2 border rounded"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={uploading || !uploadFile}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Document Viewer Modal */}
      {showDocumentViewer && selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          onClose={() => setShowDocumentViewer(false)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};

// E-Learning Widget Component
const ELearningWidget = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl('/elearning'),
        { credentials: 'include' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMaterials(data.data || []);
      } else {
        console.error('Failed to fetch E-Learning materials:', response.status);
        setMaterials([]);
      }
    } catch (error) {
      console.error('Error fetching E-Learning materials:', error);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (material) => {
    try {
      const url = buildDirectUrl(material.fileUrl);
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(url, {
        responseType: 'blob',
        withCredentials: true,
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        }
      });

      const blob = new Blob([response.data], { type: material.mimeType || 'application/octet-stream' });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = material.name || 'material';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download material');
    }
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return '📊';
    if (mimeType?.includes('word') || mimeType?.includes('document')) return '📝';
    return '📁';
  };

  const getFileType = (mimeType) => {
    if (mimeType?.includes('pdf')) return 'PDF';
    if (mimeType?.includes('presentation')) return 'PPTX';
    if (mimeType?.includes('powerpoint')) return 'PPT';
    if (mimeType?.includes('wordprocessingml')) return 'DOCX';
    if (mimeType?.includes('msword')) return 'DOC';
    return 'FILE';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-sm text-gray-600 mt-2">Loading materials...</p>
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentTextIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No materials available</h3>
        <p className="text-gray-600">Check back later for new learning resources</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {materials.map((material) => (
        <div
          key={material._id}
          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-4 flex-1">
            <div className="text-3xl flex-shrink-0">{getFileIcon(material.mimeType)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-gray-900 truncate">{material.name}</h4>
                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded flex-shrink-0">
                  {getFileType(material.mimeType)}
                </span>
              </div>
              {material.description && (
                <p className="text-sm text-gray-600 mb-1 line-clamp-1">{material.description}</p>
              )}
              <div className="flex items-center space-x-3 text-xs text-gray-500">
                <span>{formatFileSize(material.fileSize)}</span>
                <span>•</span>
                <span>{formatDateDDMMYY(material.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <button
              onClick={() => {
                // Navigate to full e-learning page for viewing
                window.location.href = '/e-learning';
              }}
              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              title="View material"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={() => handleDownload(material)}
              className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
              title="Download material"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// Leave Status Section Component
const LeaveStatusSection = ({ userId }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    if (userId) {
      fetchLeaveRequests();
    }
  }, [userId]);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl('/leave/my-requests'),
        { credentials: 'include' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setLeaveRequests(data.data || data || []);
      } else {
        console.error('Failed to fetch leave requests:', response.status);
        setLeaveRequests([]);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      setLeaveRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return <ClockIcon className="w-5 h-5" />;
      case 'approved':
        return <CheckCircleIcon className="w-5 h-5" />;
      case 'rejected':
        return <ExclamationTriangleIcon className="w-5 h-5" />;
      default:
        return <DocumentTextIcon className="w-5 h-5" />;
    }
  };

  const groupedRequests = {
    pending: leaveRequests.filter(r => r.status?.toLowerCase() === 'pending'),
    approved: leaveRequests.filter(r => r.status?.toLowerCase() === 'approved'),
    rejected: leaveRequests.filter(r => r.status?.toLowerCase() === 'rejected')
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600 mt-2">Loading leave requests...</p>
        </div>
      </div>
    );
  }

  if (leaveRequests.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Leave Requests</h3>
        <div className="text-center py-12">
          <CalendarIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No leave requests yet</h3>
          <p className="text-gray-600">Your submitted leave requests will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">My Leave Requests</h3>
      
      <div className="space-y-6">
        {/* Pending Requests */}
        {groupedRequests.pending.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ClockIcon className="w-5 h-5 text-yellow-600" />
              <h4 className="font-medium text-gray-900">
                Pending ({groupedRequests.pending.length})
              </h4>
            </div>
            <div className="space-y-3">
              {groupedRequests.pending.map((request) => (
                <div
                  key={request._id}
                  className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-gray-900">{request.leaveType}</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <strong>Dates:</strong> {formatDateDDMMYY(request.startDate)} - {formatDateDDMMYY(request.endDate)}
                        </p>
                        <p>
                          <strong>Duration:</strong> {request.numberOfDays} {request.numberOfDays === 1 ? 'day' : 'days'}
                        </p>
                        <p>
                          <strong>Reason:</strong> {request.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approved Requests */}
        {groupedRequests.approved.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
              <h4 className="font-medium text-gray-900">
                Approved ({groupedRequests.approved.length})
              </h4>
            </div>
            <div className="space-y-3">
              {groupedRequests.approved.map((request) => (
                <div
                  key={request._id}
                  className="p-4 border border-green-200 bg-green-50 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-gray-900">{request.leaveType}</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <strong>Dates:</strong> {formatDateDDMMYY(request.startDate)} - {formatDateDDMMYY(request.endDate)}
                        </p>
                        <p>
                          <strong>Duration:</strong> {request.numberOfDays} {request.numberOfDays === 1 ? 'day' : 'days'}
                        </p>
                        {request.approvedBy && (
                          <p className="text-green-700">
                            <strong>Approved by:</strong> {request.approvedBy.firstName} {request.approvedBy.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejected Requests */}
        {groupedRequests.rejected.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
              <h4 className="font-medium text-gray-900">
                Rejected ({groupedRequests.rejected.length})
              </h4>
            </div>
            <div className="space-y-3">
              {groupedRequests.rejected.map((request) => (
                <div
                  key={request._id}
                  className="p-4 border border-red-200 bg-red-50 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-gray-900">{request.leaveType}</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <strong>Dates:</strong> {formatDateDDMMYY(request.startDate)} - {formatDateDDMMYY(request.endDate)}
                        </p>
                        <p>
                          <strong>Duration:</strong> {request.numberOfDays} {request.numberOfDays === 1 ? 'day' : 'days'}
                        </p>
                        {request.rejectionReason && (
                          <p className="text-red-700">
                            <strong>Rejection reason:</strong> {request.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;
