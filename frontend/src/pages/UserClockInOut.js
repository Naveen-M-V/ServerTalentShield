import React, { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import moment from 'moment-timezone';
import { userClockIn, userClockOut, getUserClockStatus, userStartBreak, userResumeWork } from '../utils/clockApi';
import ShiftInfoCard from '../components/ShiftInfoCard';
import LoadingScreen from '../components/LoadingScreen';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDateDDMMYY, getDayName } from '../utils/dateFormatter';

/**
 * User Clock In/Out Page
 * Allows employees to clock in/out with shift linking
 */
const UserClockInOut = () => {
  const [loading, setLoading] = useState(true);
  const [clockStatus, setClockStatus] = useState(null);
  const [location, setLocation] = useState('Work From Office');
  const [workType, setWorkType] = useState('Regular');
  const [processing, setProcessing] = useState(false);
  const [shiftInfo, setShiftInfo] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [validation, setValidation] = useState(null);
  const [showClockOutDialog, setShowClockOutDialog] = useState(false);

  useEffect(() => {
    fetchClockStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchClockStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchClockStatus = async () => {
    try {
      const response = await getUserClockStatus();
      console.log('📊 Clock status response:', response);
      if (response.success && response.data) {
        console.log('✅ Setting clock status:', {
          status: response.data.status,
          clockIn: response.data.clockIn,
          clockOut: response.data.clockOut
        });
        // Always set fresh data from backend
        setClockStatus({
          status: response.data.status,
          clockIn: response.data.clockIn,
          clockOut: response.data.clockOut,
          location: response.data.location,
          workType: response.data.workType,
          breaks: response.data.breaks
        });
      } else {
        console.log('⚠️ No clock status data');
        setClockStatus(null);
      }
    } catch (error) {
      console.error('❌ Fetch clock status error:', error);
      setClockStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!location) {
      toast.warning('Please select a location');
      return;
    }

    setProcessing(true);
    try {
      const response = await userClockIn({ location, workType });
      
      if (response.success) {
        toast.success(response.message || 'Clocked in successfully!');
        
        // Store shift info for display
        if (response.data) {
          setShiftInfo(response.data.shift);
          setAttendanceStatus(response.data.attendanceStatus);
          setValidation(response.data.validation);
        }
        
        // Refresh status
        await fetchClockStatus();
        
        // Show additional warnings if needed
        if (response.data?.validation?.requiresApproval) {
          toast.warning('Late arrival detected - Manager has been notified', {
            autoClose: 5000
          });
        }
        
        if (response.data?.attendanceStatus === 'Unscheduled') {
          toast.info('No scheduled shift found - Recorded as unscheduled entry', {
            autoClose: 5000
          });
        }
      }
    } catch (error) {
      console.error('Clock in error:', error);
      // Refresh status to sync UI with backend state
      console.log('⚠️ Clock-in failed, fetching current status to sync UI...');
      await fetchClockStatus();
      
      const errorMessage = error.message || 'Failed to clock in';
      if (errorMessage.includes('already') || errorMessage.includes('clocked in')) {
        toast.warning('You are already clocked in', { autoClose: 3000 });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleClockOut = async () => {
    setProcessing(true);
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
        const hoursWorked = response.data?.hoursWorked || 0;
        const variance = response.data?.variance || 0;
        
        let message = `Clocked out successfully! Hours worked: ${hoursWorked.toFixed(2)}h`;
        
        if (variance !== 0) {
          const varianceText = variance > 0 ? `+${variance.toFixed(2)}h` : `${variance.toFixed(2)}h`;
          message += ` (Variance: ${varianceText})`;
        }
        
        toast.success(message, { autoClose: 5000 });
        
        // Clear shift info
        setShiftInfo(null);
        setAttendanceStatus(null);
        setValidation(null);
        
        // Refresh status
        await fetchClockStatus();
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
        await fetchClockStatus();
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
        await fetchClockStatus();
      }
    } catch (error) {
      console.error('Resume work error:', error);
      toast.error(error.message || 'Failed to resume work');
    } finally {
      setProcessing(false);
    }
  };

  const getCurrentTime = () => {
    return moment().tz('Europe/London').format('HH:mm:ss');
  };

  const [currentTime, setCurrentTime] = useState(getCurrentTime());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  const isClockedIn = clockStatus?.status === 'clocked_in' || clockStatus?.status === 'on_break';

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Clock In / Out
          </h1>
          <div style={{ fontSize: '48px', fontWeight: '300', color: '#3b82f6', marginBottom: '8px' }}>
            {currentTime}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {getDayName(new Date())}, {formatDateDDMMYY(new Date())}
          </div>
        </div>

        {/* Shift Info Card */}
        {isClockedIn && (shiftInfo || attendanceStatus) && (
          <ShiftInfoCard 
            shift={shiftInfo}
            attendanceStatus={attendanceStatus}
            validation={validation}
          />
        )}

        {/* Clock In Form */}
        {!isClockedIn && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '24px' }}>
              Select Clock-In Details
            </h2>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Location
              </label>
              <Select
                value={location}
                onValueChange={setLocation}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Work From Office">🏢 Work From Office</SelectItem>
                  <SelectItem value="Work From Home">🏠 Work From Home</SelectItem>
                  <SelectItem value="Field">🌍 Field</SelectItem>
                  <SelectItem value="Client Side">🤝 Client Site</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Work Type
              </label>
              <Select
                value={workType}
                onValueChange={setWorkType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select work type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Regular">⏰ Regular</SelectItem>
                  <SelectItem value="Overtime">⏱️ Overtime</SelectItem>
                  <SelectItem value="Weekend Overtime">📅 Weekend Overtime</SelectItem>
                  <SelectItem value="Client-side Overtime">🤝 Client-side Overtime</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <button
              onClick={handleClockIn}
              disabled={processing}
              style={{
                width: '100%',
                padding: '16px',
                background: processing ? '#9ca3af' : '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: '600',
                cursor: processing ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              {processing ? '⏳ Clocking In...' : '✅ Clock In'}
            </button>
          </div>
        )}

        {/* Clock Out Button */}
        {isClockedIn && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '16px',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              Current Status
            </div>
            <div style={{
              display: 'inline-block',
              padding: '8px 20px',
              background: clockStatus?.status === 'on_break' ? '#fef3c7' : '#d1fae5',
              color: clockStatus?.status === 'on_break' ? '#92400e' : '#065f46',
              borderRadius: '20px',
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '24px'
            }}>
              {clockStatus?.status === 'on_break' ? '⏸️ On Break' : '🟢 Clocked In'}
            </div>

            {clockStatus?.clockIn && (
              <div style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '24px'
              }}>
                Clocked in at: <strong>{clockStatus.clockIn}</strong>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {clockStatus?.status === 'on_break' ? (
                <button
                  onClick={handleResumeWork}
                  disabled={processing}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: processing ? '#9ca3af' : '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '18px',
                    fontWeight: '600',
                    cursor: processing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s'
                  }}
                >
                  {processing ? '⏳ Resuming...' : '▶️ Resume Work'}
                </button>
              ) : (
                <button
                  onClick={handleStartBreak}
                  disabled={processing}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: processing ? '#9ca3af' : '#f59e0b',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '18px',
                    fontWeight: '600',
                    cursor: processing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 6px rgba(245, 158, 11, 0.3)',
                    transition: 'all 0.2s'
                  }}
                >
                  {processing ? '⏳ Starting Break...' : '⏸️ Add Break'}
                </button>
              )}
              
              <button
                onClick={() => setShowClockOutDialog(true)}
                disabled={processing}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: processing ? '#9ca3af' : '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '18px',
                  fontWeight: '600',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 6px rgba(239, 68, 68, 0.3)',
                  transition: 'all 0.2s'
                }}
              >
                {processing ? '⏳ Clocking Out...' : '🚪 Clock Out'}
              </button>
            </div>
          </div>
        )}

        {/* Clock Out Confirmation Dialog */}
        <ConfirmDialog
          open={showClockOutDialog}
          onOpenChange={setShowClockOutDialog}
          title="Clock Out Confirmation"
          description="Are you sure you want to clock out? This will end your current work session."
          onConfirm={handleClockOut}
          confirmText="Clock Out"
          cancelText="Cancel"
          variant="destructive"
        />

        {/* Today's Summary */}
        {clockStatus && (
          <div style={{
            background: '#f9fafb',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
              Today's Summary
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  Clock In
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                  {clockStatus.clockIn || '--:--'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  Clock Out
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                  {clockStatus.clockOut || '--:--'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  Location
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                  {clockStatus.location || 'Not set'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  Work Type
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                  {clockStatus.workType || 'Not set'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UserClockInOut;
