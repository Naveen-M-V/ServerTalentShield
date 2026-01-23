import React, { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getClockStatus, getDashboardStats } from '../utils/clockApi';
import { getCurrentUserLeaveBalance, getNextUpcomingLeave } from '../utils/leaveApi';
import { useAuth } from '../context/AuthContext';
import { useClockStatus } from '../context/ClockStatusContext';
import { formatUKDateTime } from '../utils/timeUtils';
import LoadingScreen from '../components/LoadingScreen';

/**
 * Clock In/Out Overview Page
 * Shows current clock status and statistics for all employees
 */

const ClockInOut = () => {
  const { user } = useAuth(); // Get current logged-in user
  const { refreshTrigger } = useClockStatus(); // Listen for clock status changes
  const [clockData, setClockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    clockedIn: 0,
    clockedOut: 0,
    onBreak: 0,
    absent: 0,
    late: 0
  });
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [nextLeave, setNextLeave] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState(null); // null means show all
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchClockStatus = async () => {
    try {
      const [statusRes, statsRes, employeesRes] = await Promise.all([
        getClockStatus({ includeAdmins: true }),
        getDashboardStats(),
        fetch(`${process.env.REACT_APP_API_BASE_URL}/employees?includeAdmins=true`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Accept': 'application/json'
          }
        }).then(res => res.json())
      ]);
      
      console.log('👥 Employees Response:', employeesRes);
      console.log('⏰ Clock Status Response:', statusRes);
      console.log('📊 Stats Response:', statsRes);
      
      // Handle the new clock status response structure
      let clockStatusData = [];
      if (statusRes.success && statusRes.data) {
        // Use the main employee list from the new structure
        clockStatusData = Array.isArray(statusRes.data) ? statusRes.data : [];
      } else if (statusRes.allEmployees) {
        // Fallback to allEmployees if available
        clockStatusData = statusRes.allEmployees;
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
        
        console.log('👥 Employees with clock status:', employeesWithClockStatus.length, employeesWithClockStatus);
        
        setClockData(employeesWithClockStatus);
        
        // Always calculate stats from the full employee list for accuracy
        if (statsRes.success && statsRes.data) {
          console.log('📊 Backend stats available:', statsRes.data);
          // Always use frontend calculation for consistency
          calculateStats(employeesWithClockStatus);
        } else {
          console.log('⚠️ Backend stats failed, using frontend calculation');
          calculateStats(employeesWithClockStatus);
        }
        
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
      } else if (statusRes.success) {
        // Fallback to using clock status data directly if employee data fails
        setClockData(clockStatusData);
        calculateStats(clockStatusData);
      } else {
        setClockData([]);
        calculateStats([]);
      }
    } catch (error) {
      console.error('Clock status error:', error);
      toast.error('Failed to fetch employee clock status');
      setClockData([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveData = async () => {
    try {
      const balanceResponse = await getCurrentUserLeaveBalance();
      if (balanceResponse.success && balanceResponse.data) {
        setLeaveBalance(balanceResponse.data);
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      // Don't show error to user, just use defaults
    }

    try {
      const nextLeaveResponse = await getNextUpcomingLeave();
      if (nextLeaveResponse.success && nextLeaveResponse.data) {
        setNextLeave(nextLeaveResponse.data);
      }
    } catch (error) {
      console.error('Error fetching next leave:', error);
      // Don't show error to user
    }
  };

  // Fetch initial data
  useEffect(() => {
    fetchClockStatus();
    fetchLeaveData();
  }, []);

  // Update when refreshTrigger changes (immediate updates from user actions)
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchClockStatus();
    }
  }, [refreshTrigger]);

  // Update current time every second for accurate UK time display
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timeInterval);
  }, []);

  const calculateStats = (data) => {
    console.log('📊 Calculating stats from data:', data.length, 'employees');
    const stats = {
      total: data.length,
      clockedIn: 0,
      clockedOut: 0,
      onBreak: 0,
      absent: 0,
      late: 0
    };

    data.forEach(employee => {
      switch (employee.status) {
        case 'clocked_in':
          stats.clockedIn++;
          break;
        case 'clocked_out':
          stats.clockedOut++;
          break;
        case 'on_break':
          stats.onBreak++;
          break;
        case 'absent':
          stats.absent++;
          break;
        default:
          // Don't count null/undefined status as absent
          break;
      }
    });

    // Ensure absent count is never negative
    stats.absent = Math.max(0, stats.absent);

    console.log('📊 Final calculated stats:', stats);
    setStats(stats);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'clocked_in': return '#10b981'; // green
      case 'clocked_out': return '#3b82f6'; // blue
      case 'on_break': return '#f59e0b'; // amber
      case 'absent': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'clocked_in': return 'Clocked In';
      case 'clocked_out': return 'Clocked Out';
      case 'on_break': return 'On a break';
      case 'absent': return 'Absent';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      <div style={{
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#111827',
            marginBottom: '8px'
          }}>
            Clock In Overview
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>
            Current UK Time: {currentTime.toLocaleString('en-GB', { 
              timeZone: 'Europe/London',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
              weekday: 'short',
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })} - Updates immediately on clock actions
          </p>
        </div>

        {/* Statistics Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {/* All Profiles Card */}
          <div 
            onClick={() => setSelectedFilter(null)}
            style={{
              background: selectedFilter === null ? '#f3f4f6' : '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: selectedFilter === null ? '2px solid #6b7280' : '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <span style={{
                fontSize: '14px',
                color: '#6b7280',
                fontWeight: '500'
              }}>
                All Employees
              </span>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#6b7280'
              }}></div>
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#111827'
            }}>
              {stats.total}
            </div>
          </div>
          <div 
            onClick={() => setSelectedFilter(selectedFilter === 'clocked_in' ? null : 'clocked_in')}
            style={{
              background: selectedFilter === 'clocked_in' ? '#d1fae5' : '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: selectedFilter === 'clocked_in' ? '2px solid #10b981' : '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <span style={{
                fontSize: '14px',
                color: '#6b7280',
                fontWeight: '500'
              }}>
                Clocked In
              </span>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981'
              }}></div>
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#111827'
            }}>
              {stats.clockedIn}
            </div>
          </div>

          <div 
            onClick={() => setSelectedFilter(selectedFilter === 'clocked_out' ? null : 'clocked_out')}
            style={{
              background: selectedFilter === 'clocked_out' ? '#dbeafe' : '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: selectedFilter === 'clocked_out' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <span style={{
                fontSize: '14px',
                color: '#6b7280',
                fontWeight: '500'
              }}>
                Clocked Out
              </span>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#3b82f6'
              }}></div>
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#111827'
            }}>
              {stats.clockedOut}
            </div>
          </div>

          <div 
            onClick={() => setSelectedFilter(selectedFilter === 'on_break' ? null : 'on_break')}
            style={{
              background: selectedFilter === 'on_break' ? '#fef3c7' : '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: selectedFilter === 'on_break' ? '2px solid #f59e0b' : '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <span style={{
                fontSize: '14px',
                color: '#6b7280',
                fontWeight: '500'
              }}>
                On a break
              </span>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#f59e0b'
              }}></div>
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#111827'
            }}>
              {stats.onBreak}
            </div>
          </div>

          <div 
            onClick={() => setSelectedFilter(selectedFilter === 'absent' ? null : 'absent')}
            style={{
              background: selectedFilter === 'absent' ? '#fee2e2' : '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: selectedFilter === 'absent' ? '2px solid #ef4444' : '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <span style={{
                fontSize: '14px',
                color: '#6b7280',
                fontWeight: '500'
              }}>
                Absent
              </span>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ef4444'
              }}></div>
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#111827'
            }}>
              {stats.absent || 0}
            </div>
          </div>
        </div>

        {/* Employee List */}
        {clockData.length > 0 && (
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827'
              }}>
                {selectedFilter ? `${getStatusText(selectedFilter)} Employees` : 'Employee Status'}
              </h3>
              {selectedFilter && (
                <button
                  onClick={() => setSelectedFilter(null)}
                  style={{
                    padding: '6px 12px',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Show All
                </button>
              )}
            </div>
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              {clockData
                .filter(employee => {
                  if (!selectedFilter) return true;
                  // Only show employees with matching status (exclude null/undefined)
                  return employee.status && employee.status === selectedFilter;
                })
                .map((employee, index, filteredArray) => (
                <div key={employee.id || index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderBottom: index < clockData.length - 1 ? '1px solid #f3f4f6' : 'none'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#6b7280'
                  }}>
                    {employee.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {employee.name || 'Unknown User'}
                      {/* Show "ME" badge if this is the current user's profile */}
                      {user?.email && employee.email && user.email.toLowerCase() === employee.email.toLowerCase() && (
                        <span style={{
                          background: '#3b82f6',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          letterSpacing: '0.5px'
                        }}>
                          ME
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      marginBottom: '2px'
                    }}>
                      {employee.jobTitle || 'No Job Title'}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      marginBottom: '2px'
                    }}>
                      {employee.department || 'No Department'}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      marginBottom: '2px'
                    }}>
                      {employee.team || 'No Team'}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6b7280'
                    }}>
                      {employee.office || 'No Office'}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: getStatusColor(employee.status)
                    }}></div>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#111827'
                    }}>
                      {getStatusText(employee.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ClockInOut;
