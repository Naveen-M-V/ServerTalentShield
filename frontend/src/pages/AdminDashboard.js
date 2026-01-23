import React, { useState, useEffect } from 'react';
import { buildApiUrl } from '../utils/apiConfig';
import { useAuth } from '../context/AuthContext';
import { useClockStatus } from '../context/ClockStatusContext';
import ComplianceDashboard from '../components/ComplianceDashboard';
import Calendar from '../pages/Calendar';
import {
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

/**
 * AdminDashboard - Main admin interface with location tracking and analytics
 */
const AdminDashboard = () => {
  const { user } = useAuth();
  const { refreshTrigger } = useClockStatus();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    onBreakEmployees: 0,
    offlineEmployees: 0,
    totalCertificates: 0,
    expiringCertificates: 0,
    absentEmployees: 0,
    absentList: []
  });

  // Fetch dashboard statistics
  const fetchStats = async () => {
    try {
      // Fetch from compliance-insights endpoint which includes absent employee list
      const response = await fetch(buildApiUrl('/clock/compliance-insights'), {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setStats({
            totalEmployees: result.data.totalEmployees?.count || 0,
            activeEmployees: result.data.activeEmployees?.count || 0,
            onBreakEmployees: 0, // Not provided by compliance-insights
            offlineEmployees: 0, // Calculate if needed
            totalCertificates: 0, // Keep for backward compatibility
            expiringCertificates: 0, // Keep for backward compatibility
            absentEmployees: result.data.absentees?.count || 0,
            absentList: result.data.absentees?.employees || []
          });
        }
      } else {
        setStats({
          totalEmployees: 0,
          activeEmployees: 0,
          onBreakEmployees: 0,
          offlineEmployees: 0,
          totalCertificates: 0,
          expiringCertificates: 0,
          absentEmployees: 0,
          absentList: []
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      setStats({
        totalEmployees: 0,
        activeEmployees: 0,
        onBreakEmployees: 0,
        offlineEmployees: 0,
        totalCertificates: 0,
        expiringCertificates: 0,
        absentEmployees: 0,
        absentList: [],
        error: 'Failed to load dashboard statistics. Please try again.'
      });
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchStats();
  }, []);

  // Listen for clock refresh trigger from ClockStatusContext (cross-tab updates)
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('🔄 Clock refresh triggered in AdminDashboard, fetching latest stats...');
      fetchStats();
    }
  }, [refreshTrigger]);

  const handleEmployeeClick = (employee) => {
    console.log('Employee clicked:', employee);
    // You can implement navigation to employee details or show a modal
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'attendance', name: 'Calendar', icon: CalendarIcon },
    { id: 'compliance', name: 'Compliance', icon: DocumentTextIcon }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Welcome, {user?.name || 'Admin'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Employees */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UserGroupIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Employees
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.totalEmployees}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              {/* Active Employees */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                      <div className="h-4 w-4 bg-green-500 rounded-full"></div>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Now
                      </dt>
                      <dd className="text-3xl font-semibold text-green-600">
                        {stats.activeEmployees}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              {/* On Break */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-8 w-8 text-yellow-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        On Break
                      </dt>
                      <dd className="text-3xl font-semibold text-yellow-600">
                        {stats.onBreakEmployees}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              {/* Expiring Certificates */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Expiring Soon
                      </dt>
                      <dd className="text-3xl font-semibold text-red-600">
                        {stats.expiringCertificates}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveTab('compliance')}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <DocumentTextIcon className="w-6 h-6 text-green-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Compliance Dashboard</div>
                    <div className="text-sm text-gray-500">Monitor certificates and compliance</div>
                  </div>
                </button>

                <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <UserGroupIcon className="w-6 h-6 text-purple-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Manage Employees</div>
                    <div className="text-sm text-gray-500">Add, edit, or remove employees</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">John Doe clocked in</div>
                    <div className="text-xs text-gray-500">2 minutes ago</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Jane Smith started break</div>
                    <div className="text-xs text-gray-500">15 minutes ago</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Certificate expiring for Mike Johnson</div>
                    <div className="text-xs text-gray-500">1 hour ago</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <Calendar />
        )}

        {activeTab === 'compliance' && (
          <ComplianceDashboard />
        )}
      </div>
    </div>
  );
};

/**
 * Attendance Calendar Component for Admin Dashboard
 * Shows employee clock-in/out, lateness, and overtime data
 */
const AttendanceCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeEntries, setTimeEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedDateDetails, setSelectedDateDetails] = useState(null);

  useEffect(() => {
    fetchEmployees();
    fetchMonthEntries();
  }, [currentDate, selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch(buildApiUrl('/employees'), {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchMonthEntries = async () => {
    try {
      setLoading(true);
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const url = selectedEmployee === 'all'
        ? buildApiUrl(`/clock/time-entries?startDate=${startOfMonth.toISOString().split('T')[0]}&endDate=${endOfMonth.toISOString().split('T')[0]}`)
        : buildApiUrl(`/clock/time-entries/${selectedEmployee}?startDate=${startOfMonth.toISOString().split('T')[0]}&endDate=${endOfMonth.toISOString().split('T')[0]}`);

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setTimeEntries(data.data || data);
      }
    } catch (error) {
      console.error('Error fetching time entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const getEntriesForDate = (day) => {
    if (!day) return [];

    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return timeEntries.filter(entry => {
      const entryDate = entry.date.split('T')[0];
      return entryDate === dateStr;
    });
  };

  const isLate = (entry) => {
    if (!entry.clockIn) return false;
    const clockInTime = new Date(entry.clockIn);
    const hours = clockInTime.getHours();
    const minutes = clockInTime.getMinutes();
    return hours > 9 || (hours === 9 && minutes > 0);
  };

  const hasOvertime = (entry) => {
    if (!entry.totalHours) return false;
    return entry.totalHours > 8;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleDayClick = (day) => {
    const entries = getEntriesForDate(day);
    if (entries.length > 0) {
      setSelectedDateDetails({ day, entries });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateMonth(-1)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              ← Previous
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Next →
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Filter by Employee:</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeId || 'No ID'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>On Time</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Late</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Overtime</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>On Break</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Loading attendance data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {/* Day Headers */}
            {dayNames.map(day => (
              <div key={day} className="text-center font-semibold text-gray-700 py-2">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {getDaysInMonth().map((day, index) => {
              const entries = getEntriesForDate(day);
              const hasLate = entries.some(isLate);
              const hasOT = entries.some(hasOvertime);
              const hasBreak = entries.some(e => e.breakIn && !e.breakOut);

              return (
                <div
                  key={index}
                  onClick={() => day && handleDayClick(day)}
                  className={`min-h-24 p-2 border rounded-lg ${day ? 'bg-white hover:bg-gray-50 cursor-pointer' : 'bg-gray-100'
                    } ${entries.length > 0 ? 'border-blue-300' : 'border-gray-200'}`}
                >
                  {day && (
                    <>
                      <div className="text-sm font-medium text-gray-900 mb-1">{day}</div>
                      {entries.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600">
                            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {hasLate && (
                              <div className="w-3 h-3 bg-red-500 rounded-full" title="Late clock-in"></div>
                            )}
                            {hasOT && (
                              <div className="w-3 h-3 bg-blue-500 rounded-full" title="Overtime"></div>
                            )}
                            {hasBreak && (
                              <div className="w-3 h-3 bg-yellow-500 rounded-full" title="On break"></div>
                            )}
                            {!hasLate && !hasBreak && entries.length > 0 && (
                              <div className="w-3 h-3 bg-green-500 rounded-full" title="On time"></div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedDateDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Attendance Details - {monthNames[currentDate.getMonth()]} {selectedDateDetails.day}, {currentDate.getFullYear()}
              </h3>
              <button
                onClick={() => setSelectedDateDetails(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <ExclamationTriangleIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {selectedDateDetails.entries.map((entry, idx) => {
                const employee = employees.find(e => e._id === entry.employee);
                return (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Employee'}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {employee?.employeeId || 'No ID'} • {employee?.department || 'No Department'}
                        </p>
                      </div>
                      {isLate(entry) && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                          Late
                        </span>
                      )}
                      {hasOvertime(entry) && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          Overtime
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Clock In:</span>
                        <span className="ml-2 font-medium">{formatTime(entry.clockIn)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Clock Out:</span>
                        <span className="ml-2 font-medium">{entry.clockOut ? formatTime(entry.clockOut) : 'Still clocked in'}</span>
                      </div>
                      {entry.breakIn && (
                        <>
                          <div>
                            <span className="text-gray-600">Break Start:</span>
                            <span className="ml-2 font-medium">{formatTime(entry.breakIn)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Break End:</span>
                            <span className="ml-2 font-medium">{entry.breakOut ? formatTime(entry.breakOut) : 'On break'}</span>
                          </div>
                        </>
                      )}
                      <div>
                        <span className="text-gray-600">Total Hours:</span>
                        <span className="ml-2 font-medium">{entry.totalHours?.toFixed(2) || '0.00'} hrs</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Status:</span>
                        <span className="ml-2 font-medium capitalize">{entry.status?.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
