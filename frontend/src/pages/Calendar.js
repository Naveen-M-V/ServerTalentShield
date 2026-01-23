import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  CalendarDaysIcon,
  UserGroupIcon,
  ClockIcon,
  DocumentTextIcon,
  PlusIcon,
  ArrowPathIcon,
  CalendarIcon as CalendarOutlineIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isBetween from 'dayjs/plugin/isBetween';
import axios from '../utils/axiosConfig';
import { DatePicker } from '../components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { toast } from 'react-toastify';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(isBetween);

const Calendar = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [showDayDetailsModal, setShowDayDetailsModal] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [leaveType, setLeaveType] = useState('Paid');
  const [leaveReason, setLeaveReason] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [startHalfDay, setStartHalfDay] = useState('full');
  const [endHalfDay, setEndHalfDay] = useState('full');
  const [weekendWarning, setWeekendWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // NEW: Real data from API
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [shiftAssignments, setShiftAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // NEW: Day expansion state
  const [expandedDay, setExpandedDay] = useState(null);
  const [dayDetails, setDayDetails] = useState([]);
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar', 'pending-requests'
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [loadingApprovedRequests, setLoadingApprovedRequests] = useState(false);
  const [approvedFromDate, setApprovedFromDate] = useState('');
  const [approvedToDate, setApprovedToDate] = useState('');

  const [deniedRequests, setDeniedRequests] = useState([]);
  const [loadingDeniedRequests, setLoadingDeniedRequests] = useState(false);
  const [deniedFromDate, setDeniedFromDate] = useState('');
  const [deniedToDate, setDeniedToDate] = useState('');

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [actionRequestId, setActionRequestId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // NEW: Fetch calendar events when month changes
  useEffect(() => {
    fetchCalendarEvents();
    if (user?.role === 'admin' || user?.role === 'super-admin') {
      fetchPendingRequests();
    }
  }, [currentDate]);

  useEffect(() => {
    if (activeTab === 'approved-requests' && (user?.role === 'admin' || user?.role === 'super-admin')) {
      fetchApprovedRequests();
    }
  }, [activeTab, user?.role]);

  useEffect(() => {
    if (activeTab === 'denied-requests' && (user?.role === 'admin' || user?.role === 'super-admin')) {
      fetchDeniedRequests();
    }
  }, [activeTab, user?.role]);

  const fetchCalendarEvents = async () => {
    setLoading(true);
    setError('');
    
    try {
      const startOfMonth = currentDate.startOf('month').format('YYYY-MM-DD');
      const endOfMonth = currentDate.endOf('month').format('YYYY-MM-DD');
      
      // Fetch approved leave records
      const leaveResponse = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/leave/records`,
        {
          params: {
            startDate: startOfMonth,
            endDate: endOfMonth,
            status: 'approved'
          }
        }
      );
      
      // Fetch shift assignments
      const shiftResponse = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL}/rota/shift-assignments/all`,
        {
          params: {
            startDate: startOfMonth,
            endDate: endOfMonth
          }
        }
      );
      
      setLeaveRecords(leaveResponse.data.data || []);
      setShiftAssignments(shiftResponse.data.data || []);
      
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      setError('Failed to load calendar events. Using sample data.');
      // Don't block UI - fall back to empty arrays
      setLeaveRecords([]);
      setShiftAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeniedRequests = async () => {
    if (!['admin', 'super-admin'].includes(user?.role)) return;

    setLoadingDeniedRequests(true);
    try {
      const params = {};
      if (deniedFromDate) params.startDate = deniedFromDate;
      if (deniedToDate) params.endDate = deniedToDate;
      const response = await axios.get('/api/leave/denied-requests', { params });
      setDeniedRequests(response.data.data || []);
    } catch (error) {
      console.error('Error fetching denied requests:', error);
      toast.error('Failed to load denied requests');
    } finally {
      setLoadingDeniedRequests(false);
    }
  };

  const fetchApprovedRequests = async () => {
    if (!['admin', 'super-admin'].includes(user?.role)) return;

    setLoadingApprovedRequests(true);
    try {
      const params = {};
      if (approvedFromDate) params.startDate = approvedFromDate;
      if (approvedToDate) params.endDate = approvedToDate;
      const response = await axios.get('/api/leave/approved-requests', { params });
      setApprovedRequests(response.data.data || []);
    } catch (error) {
      console.error('Error fetching approved requests:', error);
      toast.error('Failed to load approved requests');
    } finally {
      setLoadingApprovedRequests(false);
    }
  };

  const fetchPendingRequests = async () => {
    if (!['admin', 'super-admin'].includes(user?.role)) return;
    
    setLoadingRequests(true);
    try {
      const response = await axios.get('/api/leave/pending-requests');
      setPendingRequests(response.data.data || []);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      toast.error('Failed to load pending requests');
    } finally {
      setLoadingRequests(false);
    }
  };

  const getDaysInMonth = (date) => {
    const start = date.startOf('month').startOf('week');
    const end = date.endOf('month').endOf('week');
    const days = [];
    
    let current = start;
    while (current.isBefore(end) || current.isSame(end)) {
      days.push(current);
      current = current.add(1, 'day');
    }
    
    return days;
  };

  const handlePrevMonth = () => {
    setCurrentDate(currentDate.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setCurrentDate(currentDate.add(1, 'month'));
  };

  const formatMonthYear = (date) => {
    return date.format('MMMM YYYY');
  };

  const getEventsForDate = (date) => {
    const events = [];
    const dateString = date.format('YYYY-MM-DD');
    
    // Add leave events (REAL DATA)
    leaveRecords.forEach(leave => {
      const leaveStart = dayjs(leave.startDate).format('YYYY-MM-DD');
      const leaveEnd = dayjs(leave.endDate).format('YYYY-MM-DD');
      
      if (dateString >= leaveStart && dateString <= leaveEnd) {
        const employeeName = leave.user 
          ? `${leave.user.firstName || ''} ${leave.user.lastName || ''}`.trim()
          : 'Unknown';
        
        events.push({
          type: 'leave',
          title: `${employeeName} - ${leave.type || 'Leave'}`,
          time: 'All day',
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          icon: '🏖️',
          data: leave
        });
      }
    });
    
    // Add shift events (REAL DATA)
    shiftAssignments.forEach(shift => {
      const shiftDate = dayjs(shift.date).format('YYYY-MM-DD');
      
      if (shiftDate === dateString) {
        const employeeName = shift.employeeId
          ? `${shift.employeeId.firstName || ''} ${shift.employeeId.lastName || ''}`.trim()
          : 'Unassigned';
        
        events.push({
          type: 'shift',
          title: employeeName,
          subtitle: shift.location || 'Shift',
          time: `${shift.startTime || ''} - ${shift.endTime || ''}`,
          color: shift.status === 'Completed' 
            ? 'bg-green-100 text-green-800 border-green-200'
            : shift.status === 'Missed' || shift.status === 'Cancelled'
            ? 'bg-red-100 text-red-800 border-red-200'
            : 'bg-blue-100 text-blue-800 border-blue-200',
          icon: '👔',
          employeeName,
          data: shift
        });
      }
    });
    
    return events;
  };

  // NEW: Handle day expansion
  const handleDayClick = (date) => {
    const dateString = date.format('YYYY-MM-DD');
    
    if (expandedDay === dateString) {
      // Close if clicking the same day
      setExpandedDay(null);
      setDayDetails([]);
      setActiveTab('all');
    } else {
      // Expand the clicked day
      setExpandedDay(dateString);
      fetchDayDetails(date);
    }
  };

  // NEW: Fetch detailed information for a specific day
  const fetchDayDetails = async (date) => {
    const dateString = date.format('YYYY-MM-DD');
    const details = [];
    
    // Process leave records for this day
    leaveRecords.forEach(leave => {
      const leaveStart = dayjs(leave.startDate).format('YYYY-MM-DD');
      const leaveEnd = dayjs(leave.endDate).format('YYYY-MM-DD');
      
      if (dateString >= leaveStart && dateString <= leaveEnd) {
        const employeeName = leave.user 
          ? `${leave.user.firstName || ''} ${leave.user.lastName || ''}`.trim()
          : 'Unknown';
        
        const duration = dayjs(leave.endDate).diff(dayjs(leave.startDate), 'day') + 1;
        const isLongTerm = duration > 7;
        
        details.push({
          id: leave._id,
          type: 'leave',
          employeeName,
          startDate: dayjs(leave.startDate).format('ddd D MMM YY'),
          endDate: dayjs(leave.endDate).format('ddd D MMM YY'),
          duration: `${duration} day${duration > 1 ? 's' : ''}`,
          leaveType: leave.type || 'Annual leave',
          category: isLongTerm ? 'long-term' : 'short-term',
          status: leave.status || 'approved',
          icon: '🏖️',
          color: isLongTerm ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'
        });
      }
    });
    
    // Process shift assignments for this day
    shiftAssignments.forEach(shift => {
      const shiftDate = dayjs(shift.date).format('YYYY-MM-DD');
      
      if (shiftDate === dateString) {
        const employeeName = shift.employeeId
          ? `${shift.employeeId.firstName || ''} ${shift.employeeId.lastName || ''}`.trim()
          : 'Unassigned';
        
        details.push({
          id: shift._id,
          type: 'shift',
          employeeName,
          startDate: dayjs(shift.date).format('ddd D MMM YY'),
          endDate: dayjs(shift.date).format('ddd D MMM YY'),
          duration: '1 day',
          leaveType: `${shift.location || 'Shift'} - ${shift.startTime || ''} to ${shift.endTime || ''}`,
          category: 'shift',
          status: shift.status || 'Scheduled',
          icon: '👔',
          color: shift.status === 'Completed' 
            ? 'bg-green-100 text-green-800'
            : shift.status === 'Missed' || shift.status === 'Cancelled'
            ? 'bg-red-100 text-red-800'
            : 'bg-blue-100 text-blue-800'
        });
      }
    });
    
    setDayDetails(details);
  };

  // NEW: Filter details based on active tab
  const getFilteredDetails = () => {
    switch (activeTab) {
      case 'short-term':
        return dayDetails.filter(detail => detail.category === 'short-term');
      case 'long-term':
        return dayDetails.filter(detail => detail.category === 'long-term');
      default:
        return dayDetails;
    }
  };

  // NEW: Get tab counts
  const getTabCounts = () => {
    const all = dayDetails.length;
    const shortTerm = dayDetails.filter(detail => detail.category === 'short-term').length;
    const longTerm = dayDetails.filter(detail => detail.category === 'long-term').length;
    
    return { all, shortTerm, longTerm };
  };

  // Load employees when modal opens (REAL DATA)
  const loadEmployees = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/employees`);
      const employeeData = response.data.data || [];
      
      // Transform to format expected by modal
      const formattedEmployees = employeeData.map(emp => ({
        id: emp._id,
        name: `${emp.firstName} ${emp.lastName}`,
        email: emp.email,
        department: emp.department
      }));
      
      setEmployees(formattedEmployees);
    } catch (error) {
      console.error('Error loading employees:', error);
      setError('Failed to load employees');
    }
  };

  // Check if selected dates include weekends
  const checkWeekendDays = (start, end) => {
    if (!start || !end) {
      setWeekendWarning('');
      return;
    }

    try {
      // Ensure we have dayjs objects
      let startDate, endDate;
      
      if (dayjs.isDayjs(start)) {
        startDate = start;
      } else if (start instanceof Date) {
        startDate = dayjs(start);
      } else if (typeof start === 'object' && start.$d) {
        startDate = dayjs(start.$d);
      } else {
        startDate = dayjs(start);
      }
      
      if (dayjs.isDayjs(end)) {
        endDate = end;
      } else if (end instanceof Date) {
        endDate = dayjs(end);
      } else if (typeof end === 'object' && end.$d) {
        endDate = dayjs(end.$d);
      } else {
        endDate = dayjs(end);
      }

      // Validate the dayjs objects
      if (!startDate.isValid() || !endDate.isValid()) {
        setWeekendWarning('');
        return;
      }

      let hasWeekend = false;
      let current = startDate;
      const endDay = endDate;

      while (current.isSameOrBefore(endDay)) {
        if (current.day() === 0 || current.day() === 6) { // Sunday or Saturday
          hasWeekend = true;
          break;
        }
        current = current.add(1, 'day');
      }

      if (hasWeekend) {
        setWeekendWarning('Saturday is not a working day');
      } else {
        setWeekendWarning('');
      }
    } catch (error) {
      console.error('Weekend check error:', error);
      setWeekendWarning('');
    }
  };

  // Calculate working days between dates
  const calculateWorkingDays = (start, end) => {
    if (!start || !end) return 0;
    
    try {
      // Ensure we have dayjs objects
      let startDate, endDate;
      
      if (dayjs.isDayjs(start)) {
        startDate = start;
      } else if (start instanceof Date) {
        startDate = dayjs(start);
      } else if (typeof start === 'object' && start.$d) {
        startDate = dayjs(start.$d);
      } else {
        startDate = dayjs(start);
      }
      
      if (dayjs.isDayjs(end)) {
        endDate = end;
      } else if (end instanceof Date) {
        endDate = dayjs(end);
      } else if (typeof end === 'object' && end.$d) {
        endDate = dayjs(end.$d);
      } else {
        endDate = dayjs(end);
      }

      // Validate the dayjs objects
      if (!startDate.isValid() || !endDate.isValid()) {
        return 0;
      }
      
      let workingDays = 0;
      let current = startDate;
      const endDay = endDate;

      while (current.isSameOrBefore(endDay)) {
        if (current.day() !== 0 && current.day() !== 6) { // Not Sunday or Saturday
          workingDays++;
        }
        current = current.add(1, 'day');
      }

      // Adjust for half days
      if (startHalfDay !== 'full') workingDays -= 0.5;
      if (endHalfDay !== 'full' && !startDate.isSame(endDate)) workingDays -= 0.5;

      return Math.max(0, workingDays);
    } catch (error) {
      console.error('Working days calculation error:', error);
      return 0;
    }
  };

  // Handle date changes
  const handleStartDateChange = (date) => {
    // Handle different types of date objects from DatePicker
    let dayjsDate = null;
    
    if (date) {
      try {
        if (dayjs.isDayjs(date)) {
          dayjsDate = date;
        } else if (date instanceof Date) {
          dayjsDate = dayjs(date);
        } else if (typeof date === 'object' && date.$d) {
          // Handle moment-like objects
          dayjsDate = dayjs(date.$d);
        } else if (typeof date === 'string') {
          dayjsDate = dayjs(date);
        } else {
          // Last resort - try to convert
          dayjsDate = dayjs(date);
        }
      } catch (error) {
        console.error('Date conversion error:', error);
        dayjsDate = null;
      }
    }
    
    setStartDate(dayjsDate);
    checkWeekendDays(dayjsDate, endDate);
  };

  const handleEndDateChange = (date) => {
    // Handle different types of date objects from DatePicker
    let dayjsDate = null;
    
    if (date) {
      try {
        if (dayjs.isDayjs(date)) {
          dayjsDate = date;
        } else if (date instanceof Date) {
          dayjsDate = dayjs(date);
        } else if (typeof date === 'object' && date.$d) {
          // Handle moment-like objects
          dayjsDate = dayjs(date.$d);
        } else if (typeof date === 'string') {
          dayjsDate = dayjs(date);
        } else {
          // Last resort - try to convert
          dayjsDate = dayjs(date);
        }
      } catch (error) {
        console.error('Date conversion error:', error);
        dayjsDate = null;
      }
    }
    
    setEndDate(dayjsDate);
    checkWeekendDays(startDate, dayjsDate);
  };

  // Open modal
  const openTimeOffModal = () => {
    setShowTimeOffModal(true);
    loadEmployees();
  };

  // Close modal
  const closeTimeOffModal = () => {
    setShowTimeOffModal(false);
    setSelectedEmployee('');
    setLeaveType('Paid');
    setLeaveReason('');
    setStartDate(null);
    setEndDate(null);
    setStartHalfDay('full');
    setEndHalfDay('full');
    setWeekendWarning('');
  };

  // Submit time off request
  const handleSubmitTimeOff = async () => {
    if (!isFormValid()) return;

    setSubmitting(true);
    try {
      // Determine employee ID - either selected or current user
      const employeeId = selectedEmployee || user?.id || user?._id;
      
      if (!employeeId) {
        toast.error('Unable to identify employee');
        return;
      }

      const workingDays = calculateWorkingDays(startDate, endDate);

      const response = await axios.post(
        '/api/leave/admin/time-off',
        {
          employeeId,
          leaveType: leaveType,
          startDate: startDate.format('YYYY-MM-DD'),
          endDate: endDate.format('YYYY-MM-DD'),
          days: workingDays,
          reason: leaveReason,
          startHalfDay,
          endHalfDay
        }
      );

      if (response.data.success) {
        toast.success(
          (user?.role === 'admin' || user?.role === 'super-admin')
            ? 'Leave request submitted successfully!'
            : 'Leave request submitted and awaiting approval'
        );
        closeTimeOffModal();
        fetchCalendarEvents(); // Refresh calendar
      }
    } catch (error) {
      console.error('Submit time off error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to submit leave request';
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Check if form is valid for submission
  const isFormValid = () => {
    // Reason must be at least 10 characters (backend requirement)
    const hasValidReason = leaveReason && leaveReason.trim().length >= 10;
    
    // For admin users, they must select an employee
    if (user?.role === 'admin' || user?.role === 'super-admin') {
      return selectedEmployee && startDate && endDate && hasValidReason && !weekendWarning;
    }
    // For regular users
    return startDate && endDate && hasValidReason && !weekendWarning;
  };

  const handleApproveRequest = async (requestId) => {
    try {
      await axios.patch(`/api/leave/approve/${requestId}`);
      toast.success('Leave request approved');
      fetchPendingRequests();
      fetchCalendarEvents(); // Refresh calendar
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error(error.response?.data?.message || 'Failed to approve request');
    }
  };

  const handleRejectRequest = async (requestId, reason) => {
    try {
      await axios.patch(`/api/leave/reject/${requestId}`, { rejectionReason: reason });
      toast.success('Leave request rejected');
      fetchPendingRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error(error.response?.data?.message || 'Failed to reject request');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-600">Manage your schedule and view upcoming events</p>
        
        {/* Error Alert */}
        {error && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">{error}</p>
          </div>
        )}
        
        {/* Loading Indicator */}
        {loading && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">Loading calendar events...</p>
          </div>
        )}
      </div>

      {/* Tabs for Admin */}
      {(user?.role === 'admin' || user?.role === 'super-admin') && (
        <div className="mb-4 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-4 py-2 border-b-2 font-medium transition-colors ${
                activeTab === 'calendar'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setActiveTab('pending-requests')}
              className={`px-4 py-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'pending-requests'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending requests
              {pendingRequests.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            {(user?.role === 'admin' || user?.role === 'super-admin') && (
              <button
                onClick={() => setActiveTab('approved-requests')}
                className={`px-4 py-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'approved-requests'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Approved requests
                {approvedRequests.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                    {approvedRequests.length}
                  </span>
                )}
              </button>
            )}

            {(user?.role === 'admin' || user?.role === 'super-admin') && (
              <button
                onClick={() => setActiveTab('denied-requests')}
                className={`px-4 py-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'denied-requests'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Denied requests
                {deniedRequests.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                    {deniedRequests.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Calendar View */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-lg shadow">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Calendar</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <span className="text-sm font-medium">{formatMonthYear(currentDate)}</span>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={openTimeOffModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Time Off</span>
            </button>
          </div>
        </div>

        {/* Week Days Header */}
        <div className="grid grid-cols-7 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {getDaysInMonth(currentDate).map((date, index) => {
            const isCurrentMonth = date.isSame(currentDate, 'month');
            const isToday = date.isSame(dayjs(), 'day');
            const isSelected = date.isSame(selectedDate, 'day');
            const events = getEventsForDate(date);
            
            return (
              <div
                key={index}
                className={`min-h-[80px] p-2 border-r border-b cursor-pointer transition-colors ${
                  !isCurrentMonth ? 'bg-gray-50' : 'bg-white'
                } ${isToday ? 'bg-blue-50' : ''} ${isSelected ? 'ring-2 ring-blue-500' : ''} hover:bg-gray-50`}
                onClick={() => {
                  setSelectedDate(date);
                  setSelectedDayEvents(events);
                  setShowDayDetailsModal(true);
                }}
              >
                <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                  {date.format('D')}
                </div>
                
                {/* Events */}
                <div className="mt-1 space-y-1">
                  {events.slice(0, 2).map((event, eventIndex) => (
                    <div
                      key={eventIndex}
                      className={`text-xs p-1 rounded border ${event.color}`}
                      title={`${event.employeeName || event.title}${event.time ? ` (${event.time})` : ''}`}
                    >
                      <div className="font-semibold truncate">
                        {event.employeeName || event.title}
                      </div>
                      {event.time && event.type === 'shift' && (
                        <div className="text-[10px] opacity-75 truncate">
                          {event.time}
                        </div>
                      )}
                    </div>
                  ))}
                  {events.length > 2 && (
                    <div className="text-xs text-gray-500">+{events.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day Details Modal - Popup Style */}
        {showDayDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            {/* Modal Header - Enhanced */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-t-xl shadow-lg">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                  <CalendarDaysIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedDate.format('dddd, MMMM D, YYYY')}
                  </h2>
                  <p className="text-blue-100 text-sm mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <UserGroupIcon className="h-4 w-4" />
                      {selectedDayEvents.filter(e => e.type === 'shift').length} shift{selectedDayEvents.filter(e => e.type === 'shift').length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-blue-200">•</span>
                    <span className="flex items-center gap-1">
                      <CalendarOutlineIcon className="h-4 w-4" />
                      {selectedDayEvents.filter(e => e.type === 'leave').length} time off
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDayDetailsModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-all text-white hover:scale-110"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
              {selectedDayEvents.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center py-20">
                    <div className="bg-gray-100 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-6">
                      <CalendarDaysIcon className="h-16 w-16 text-gray-400" />
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-900 mb-3">No events scheduled</h3>
                    <p className="text-gray-500 text-lg mb-8">This day is currently free.</p>
                    <button
                      onClick={() => {
                        setShowDayDetailsModal(false);
                        openTimeOffModal();
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl text-lg font-medium"
                    >
                      <PlusIcon className="h-5 w-5" />
                      Schedule Time Off
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Shifts Section */}
                  {selectedDayEvents.filter(e => e.type === 'shift').length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <UserGroupIcon className="h-5 w-5 text-blue-600" />
                          </div>
                          Scheduled Shifts
                        </h3>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                          {selectedDayEvents.filter(e => e.type === 'shift').length}
                        </span>
                      </div>
                      <div className="space-y-3 max-h-[350px] overflow-y-auto">
                        {selectedDayEvents.filter(e => e.type === 'shift').map((event, idx) => (
                          <div key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-4 hover:shadow-md transition-all">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{event.icon}</span>
                                <div>
                                  <h4 className="font-bold text-gray-900 text-base">{event.employeeName || event.title}</h4>
                                  {event.subtitle && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      📍 {event.subtitle}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${event.color} shadow-sm`}>
                                {event.data.status || 'Scheduled'}
                              </span>
                            </div>
                            
                            <div className="space-y-2 ml-11">
                              <div className="flex items-center gap-2 text-sm">
                                <ClockIcon className="h-4 w-4 text-blue-600" />
                                <span className="font-semibold text-gray-800">{event.time}</span>
                              </div>
                              
                              {event.data.notes && (
                                <div className="bg-white rounded-lg p-2 border border-blue-200">
                                  <p className="text-xs text-gray-700">💬 {event.data.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Time Off Section */}
                  {selectedDayEvents.filter(e => e.type === 'leave').length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <div className="bg-amber-100 p-2 rounded-lg">
                            <CalendarDaysIcon className="h-5 w-5 text-amber-600" />
                          </div>
                          Time Off Requests
                        </h3>
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                          {selectedDayEvents.filter(e => e.type === 'leave').length}
                        </span>
                      </div>
                      <div className="space-y-3 max-h-[350px] overflow-y-auto">
                        {selectedDayEvents.filter(e => e.type === 'leave').map((event, idx) => (
                          <div key={idx} className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 rounded-lg p-3 hover:shadow-md transition-all">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-2xl">{event.icon}</span>
                                  <div>
                                    <h4 className="font-bold text-gray-900">{event.title}</h4>
                                    <p className="text-xs text-gray-600 mt-1">{event.time}</p>
                                  </div>
                                </div>
                                {event.data.reason && (
                                  <div className="bg-white rounded-lg p-2 mt-2 border border-amber-200">
                                    <p className="text-xs text-gray-700 italic">💬 "{event.data.reason}"</p>
                                  </div>
                                )}
                                {event.data.days && (
                                  <div className="flex flex-col gap-1 mt-2 text-xs text-gray-600">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">⏱️</span>
                                      <span className="font-semibold">{event.data.days} day(s)</span>
                                    </div>
                                    {event.data.startDate && event.data.endDate && (
                                      <div className="flex items-center gap-2 ml-5">
                                        <span className="font-medium">📅</span>
                                        <span className="font-semibold text-blue-600">
                                          {event.data.startDate} - {event.data.endDate}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${event.color} shadow-sm`}>
                                {event.data.leaveType || event.data.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer - Enhanced */}
            <div className="border-t border-gray-200 bg-white p-4 rounded-b-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">{selectedDayEvents.length}</span> total event(s) on this day
                </div>
                <button
                  onClick={() => setShowDayDetailsModal(false)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold shadow-md hover:shadow-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Time Off Modal */}
        {showTimeOffModal && (
        <div className="fixed inset-0 z-50 flex">
          {/* Dark backdrop */}
          <div 
            className="flex-1 bg-black/50"
            onClick={closeTimeOffModal}
          ></div>

          {/* Modal content */}
          <div className="w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Time Off</h2>
              <button
                onClick={closeTimeOffModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Employee Selection - Only for admins */}
              {(user?.role === 'admin' || user?.role === 'super-admin') && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee <span className="text-red-500">*</span>
                  </label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Leave Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Leave Type <span className="text-red-500">*</span>
                </label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid Leave</SelectItem>
                    <SelectItem value="Casual">Casual Leave</SelectItem>
                    <SelectItem value="Sick">Sick Leave</SelectItem>
                    <SelectItem value="Unpaid">Unpaid Leave</SelectItem>
                    <SelectItem value="Maternity">Maternity Leave</SelectItem>
                    <SelectItem value="Paternity">Paternity Leave</SelectItem>
                    <SelectItem value="Bereavement">Bereavement Leave</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reason */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Enter reason for leave request (minimum 10 characters)..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Date Selection */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <DatePicker
                    label="Start Date"
                    value={startDate}
                    onChange={handleStartDateChange}
                    required
                    className="w-full"
                  />
                  <div className="mt-2">
                    <Select value={startHalfDay} onValueChange={setStartHalfDay}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Day</SelectItem>
                        <SelectItem value="first">First Half</SelectItem>
                        <SelectItem value="second">Second Half</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <DatePicker
                    label="End Date"
                    value={endDate}
                    onChange={handleEndDateChange}
                    required
                    minDate={startDate}
                    className="w-full"
                  />
                  <div className="mt-2">
                    <Select value={endHalfDay} onValueChange={setEndHalfDay}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Day</SelectItem>
                        <SelectItem value="first">First Half</SelectItem>
                        <SelectItem value="second">Second Half</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Weekend Warning */}
              {weekendWarning && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">{weekendWarning}</p>
                </div>
              )}

              {/* Summary */}
              {startDate && endDate && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    You were off from <strong>{startDate.format('dddd, D MMMM YYYY')}</strong> until{' '}
                    <strong>{endDate.format('dddd, D MMMM YYYY')}</strong> and{' '}
                    <strong>{calculateWorkingDays(startDate, endDate)} day(s)</strong> will be deducted from your entitlement.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeTimeOffModal}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitTimeOff}
                  disabled={!isFormValid() || submitting}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    isFormValid() && !submitting
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {submitting ? 'Submitting...' : (user?.role === 'admin' || user?.role === 'super-admin') ? 'Add Absence' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
      )}

      {/* Pending Requests View - Admin Only */}
      {activeTab === 'pending-requests' && (user?.role === 'admin' || user?.role === 'super-admin') && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Leave Requests</h2>
          
          {loadingRequests ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading requests...</p>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-12">
              <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Requests</h3>
              <p className="text-gray-600">All leave requests have been processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-700">
                            {request.employeeId?.firstName?.[0]}{request.employeeId?.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {request.employeeId?.firstName} {request.employeeId?.lastName}
                          </h3>
                          <p className="text-sm text-gray-500">{request.employeeId?.email}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-xs text-gray-500">Leave Type</p>
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                            request.leaveType === 'Sick' ? 'bg-red-100 text-red-800' :
                            request.leaveType === 'Casual' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {request.leaveType}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Date Range</p>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(request.startDate).toLocaleDateString('en-GB')} - {new Date(request.endDate).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Duration</p>
                          <p className="text-sm font-medium text-gray-900">{request.numberOfDays} day(s)</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Requested</p>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(request.createdAt).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                      </div>
                      
                      {request.reason && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">Reason</p>
                          <p className="text-sm text-gray-900">{request.reason}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => {
                          setActionRequestId(request._id);
                          setApproveDialogOpen(true);
                        }}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setActionRequestId(request._id);
                          setRejectionReason('');
                          setRejectDialogOpen(true);
                        }}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approved Requests View - Admin Only */}
      {activeTab === 'approved-requests' && (user?.role === 'admin' || user?.role === 'super-admin') && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Approved Leave Requests</h2>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <DatePicker
                  label="From date"
                  value={approvedFromDate}
                  onChange={(d) => setApprovedFromDate(d ? d.format('YYYY-MM-DD') : '')}
                  className="w-full"
                />
              </div>

              <div>
                <DatePicker
                  label="To date"
                  value={approvedToDate}
                  onChange={(d) => setApprovedToDate(d ? d.format('YYYY-MM-DD') : '')}
                  className="w-full"
                />
              </div>

              <div>
                <button
                  onClick={() => fetchApprovedRequests()}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Apply filter
                </button>
              </div>

              <div>
                <button
                  onClick={() => {
                    setApprovedFromDate('');
                    setApprovedToDate('');
                    fetchApprovedRequests();
                  }}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {loadingApprovedRequests ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <p className="mt-2 text-gray-600">Loading requests...</p>
            </div>
          ) : approvedRequests.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Approved Requests</h3>
              <p className="text-gray-600">You haven't approved any leave requests yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvedRequests.map((request) => (
                <div key={request._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-sm font-semibold text-green-700">
                            {request.employeeId?.firstName?.[0]}{request.employeeId?.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {request.employeeId?.firstName} {request.employeeId?.lastName}
                          </h3>
                          <p className="text-sm text-gray-500">{request.employeeId?.email}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-xs text-gray-500">Leave Type</p>
                          <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {request.leaveType}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Date Range</p>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(request.startDate).toLocaleDateString('en-GB')} - {new Date(request.endDate).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Duration</p>
                          <p className="text-sm font-medium text-gray-900">{request.numberOfDays} day(s)</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Approved</p>
                          <p className="text-sm font-medium text-gray-900">
                            {request.approvedAt ? new Date(request.approvedAt).toLocaleDateString('en-GB') : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Approved By</p>
                          <p className="text-sm font-medium text-gray-900">
                            {request.approvedBy ? `${request.approvedBy.firstName} ${request.approvedBy.lastName}` : '-'}
                          </p>
                        </div>
                      </div>

                      {request.reason && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">Reason</p>
                          <p className="text-sm text-gray-900">{request.reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Denied Requests View - Admin Only */}
      {activeTab === 'denied-requests' && (user?.role === 'admin' || user?.role === 'super-admin') && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Denied Leave Requests</h2>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <DatePicker
                  label="From date"
                  value={deniedFromDate}
                  onChange={(d) => setDeniedFromDate(d ? d.format('YYYY-MM-DD') : '')}
                  className="w-full"
                />
              </div>

              <div>
                <DatePicker
                  label="To date"
                  value={deniedToDate}
                  onChange={(d) => setDeniedToDate(d ? d.format('YYYY-MM-DD') : '')}
                  className="w-full"
                />
              </div>

              <div>
                <button
                  onClick={() => fetchDeniedRequests()}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Apply filter
                </button>
              </div>

              <div>
                <button
                  onClick={() => {
                    setDeniedFromDate('');
                    setDeniedToDate('');
                    fetchDeniedRequests();
                  }}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {loadingDeniedRequests ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <p className="mt-2 text-gray-600">Loading requests...</p>
            </div>
          ) : deniedRequests.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Denied Requests</h3>
              <p className="text-gray-600">You haven't denied any leave requests yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {deniedRequests.map((request) => (
                <div key={request._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                          <span className="text-sm font-semibold text-red-700">
                            {request.employeeId?.firstName?.[0]}{request.employeeId?.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {request.employeeId?.firstName} {request.employeeId?.lastName}
                          </h3>
                          <p className="text-sm text-gray-500">{request.employeeId?.email}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-xs text-gray-500">Leave Type</p>
                          <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            {request.leaveType}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Date Range</p>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(request.startDate).toLocaleDateString('en-GB')} - {new Date(request.endDate).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Duration</p>
                          <p className="text-sm font-medium text-gray-900">{request.numberOfDays} day(s)</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Denied</p>
                          <p className="text-sm font-medium text-gray-900">
                            {request.rejectedAt ? new Date(request.rejectedAt).toLocaleDateString('en-GB') : '-'}
                          </p>
                        </div>
                      </div>

                      {request.rejectionReason && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">Rejection reason</p>
                          <p className="text-sm text-gray-900">{request.rejectionReason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve leave request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the request as approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setApproveDialogOpen(false);
                setActionRequestId(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!actionRequestId) return;
                await handleApproveRequest(actionRequestId);
                setApproveDialogOpen(false);
                setActionRequestId(null);
              }}
              className="bg-green-600 hover:bg-green-700 focus-visible:ring-green-600"
            >
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline leave request?</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejection.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-4">
            <label htmlFor="leave-rejection-reason" className="block text-sm font-medium text-gray-700 mb-2">
              Rejection reason
            </label>
            <textarea
              id="leave-rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">
              {(rejectionReason || '').length}/500 characters
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setRejectDialogOpen(false);
                setActionRequestId(null);
                setRejectionReason('');
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const r = (rejectionReason || '').trim();
                if (!actionRequestId || !r) return;
                await handleRejectRequest(actionRequestId, r);
                setRejectDialogOpen(false);
                setActionRequestId(null);
                setRejectionReason('');
              }}
              disabled={!actionRequestId || (rejectionReason || '').trim().length === 0}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
            >
              Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Calendar;
