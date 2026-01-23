import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCertificates } from '../context/CertificateContext';
import { useAuth } from '../context/AuthContext';
import ComplianceInsights from './ComplianceInsights';
import AdminClockInModal from './AdminClockInModal';
import AdminClockOutModal from './AdminClockOutModal';
import EmployeeMap from './employeeLiveMap';
import { ClockIcon } from '@heroicons/react/24/outline';
import { getUserClockStatus, userClockOut, userStartBreak, userResumeWork } from '../utils/clockApi';
import { getCurrentUserLeaveBalance, getNextUpcomingLeave } from '../utils/leaveApi';
import { toast } from 'react-toastify';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { formatDateDDMMYY } from '../utils/dateFormatter';

const ComplianceDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    certificates,
    loading,
    getActiveCertificatesCount,
    getExpiringCertificates,
    getExpiredCertificates,
    getCertificatesByCategory,
    getCertificatesByJobRole
  } = useCertificates();

  const [selectedTimeframe, setSelectedTimeframe] = useState(30);
  const [showAdminClockInModal, setShowAdminClockInModal] = useState(false);
  const [showAdminClockOutModal, setShowAdminClockOutModal] = useState(false);
  const [clockStatus, setClockStatus] = useState(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    activeCount: 0,
    expiringCertificates: [],
    expiredCertificates: [],
    categoryCounts: {},
    jobRoleCounts: {}
  });
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [nextLeave, setNextLeave] = useState(null);
  const [gpsCoordinates, setGpsCoordinates] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);

  useEffect(() => {
    fetchClockStatus();
    fetchLeaveData();
    captureCurrentLocation();
  }, []);

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
        },
        (error) => {
          // Don't show error to user, just leave map empty
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
      const response = await getUserClockStatus();
      if (response.success && response.data) {
        setClockStatus(response.data);
      }
    } catch (error) {
    }
  };

  const fetchLeaveData = async () => {
    try {
      const balanceResponse = await getCurrentUserLeaveBalance();
      if (balanceResponse.success) {
        setLeaveBalance(balanceResponse.data);
      }

      const nextLeaveResponse = await getNextUpcomingLeave();
      if (nextLeaveResponse.success) {
        setNextLeave(nextLeaveResponse.data);
      }
    } catch (error) {
      console.error('Failed to fetch leave data:', error);
    }
  };

  useEffect(() => {
    const getDashboardData = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/certificates/dashboard-stats?days=${selectedTimeframe}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch dashboard stats: ${response.status}`);
        }

        const data = await response.json();
        setDashboardData({
          activeCount: data.activeCount,
          expiringCertificates: data.expiringCertificates,
          expiredCertificates: data.expiredCertificates,
          categoryCounts: data.categoryCounts,
          jobRoleCounts: getCertificatesByJobRole()
        });
      } catch (error) {
        // Set empty data on error so UI doesn't hang
        setDashboardData({
          activeCount: 0,
          expiringCertificates: [],
          expiredCertificates: [],
          categoryCounts: {},
          jobRoleCounts: {}
        });
      }
    };

    getDashboardData();
  }, [selectedTimeframe, certificates]);


  const formatDate = (dateString) => {
    return formatDateDDMMYY(dateString);
  };

  const getDaysUntilExpiry = (expiryDate) => {
    const [day, month, year] = expiryDate.split('/');
    const expiry = new Date(year, month - 1, day);
    const today = new Date();
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryStatusColor = (daysUntilExpiry) => {
    if (daysUntilExpiry < 0) return 'text-red-600 bg-red-50';
    if (daysUntilExpiry <= 7) return 'text-red-600 bg-red-50';
    if (daysUntilExpiry <= 30) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const handleClockOut = async () => {
    setShowAdminClockOutModal(true);
  };

  const onClockOutComplete = async () => {
    await fetchClockStatus();
  };

  const handleStartBreak = async () => {
    setClockLoading(true);
    try {
      const response = await userStartBreak();
      if (response.success) {
        toast.success('Break started');
        await fetchClockStatus();
      } else {
        toast.error(response.message || 'Failed to start break');
      }
    } catch (error) {
      toast.error('Failed to start break');
    } finally {
      setClockLoading(false);
    }
  };

  const handleResumeWork = async () => {
    setClockLoading(true);
    try {
      const response = await userResumeWork();
      if (response.success) {
        toast.success('Work resumed');
        await fetchClockStatus();
      } else {
        toast.error(response.message || 'Failed to resume work');
      }
    } catch (error) {
      toast.error('Failed to resume work');
    } finally {
      setClockLoading(false);
    }
  };

  const isClockedIn = clockStatus?.status === 'clocked_in' || clockStatus?.status === 'on_break';

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Compliance Dashboard</h1>
        <div className="flex items-center space-x-4">
          {isClockedIn ? (
            <>
              {clockStatus?.status === 'on_break' ? (
                <button
                  onClick={handleResumeWork}
                  disabled={clockLoading}
                  className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ClockIcon className="h-5 w-5 mr-2" />
                  {clockLoading ? 'Resuming...' : 'Resume Work'}
                </button>
              ) : (
                <button
                  onClick={handleStartBreak}
                  disabled={clockLoading}
                  className="inline-flex items-center px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ClockIcon className="h-5 w-5 mr-2" />
                  {clockLoading ? 'Starting...' : 'Start Break'}
                </button>
              )}
              <button
                onClick={handleClockOut}
                className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200"
              >
                <ClockIcon className="h-5 w-5 mr-2" />
                Clock Out
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAdminClockInModal(true)}
              disabled={clockLoading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ClockIcon className="h-5 w-5 mr-2" />
              {clockLoading ? 'Loading...' : 'Clock In'}
            </button>
          )}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Expiry Alert Period:</label>
            <Select
              value={selectedTimeframe.toString()}
              onValueChange={(value) => setSelectedTimeframe(parseInt(value))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Compliance Insights Section */}
      <ComplianceInsights />

      {/* Live Location Map */}
      {gpsCoordinates?.latitude && gpsCoordinates?.longitude && (
        <div style={{ marginTop: '32px', marginBottom: '32px' }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '16px'
          }}>
            📍 Your Live Location
          </h3>
          <EmployeeMap
            latitude={gpsCoordinates.latitude}
            longitude={gpsCoordinates.longitude}
          />
        </div>
      )}

      
      {/* Admin Clock-In Modal */}
      {showAdminClockInModal && (
        <AdminClockInModal
          user={user}
          onClose={() => setShowAdminClockInModal(false)}
          onClockIn={async (data) => {
            // Fetch the latest clock status to update the UI
            await fetchClockStatus();
          }}
        />
      )}

      {/* Admin Clock-Out Modal */}
      {showAdminClockOutModal && (
        <AdminClockOutModal
          user={user}
          onClose={() => setShowAdminClockOutModal(false)}
          onClockOut={async () => {
            setShowAdminClockOutModal(false);
            await fetchClockStatus();
          }}
        />
      )}
    </div>
  );
};

export default ComplianceDashboard;
