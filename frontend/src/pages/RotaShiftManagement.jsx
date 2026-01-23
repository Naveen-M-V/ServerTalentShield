import React, { useState, useEffect } from 'react';
import {
  generateRota,
  getAllRota,
  getEmployeeRota,
  updateRota,
  deleteRota,
  initializeShifts,
  assignShift,
  assignShiftToTeam,
  bulkCreateShifts,
  getAllShiftAssignments,
  getGroupedShiftAssignments,
  getEmployeeShifts,
  getShiftsByLocation,
  getShiftStatistics,
  updateShiftAssignment,
  deleteShiftAssignment,
  deleteShiftAssignmentGroup,
  requestShiftSwap,
  approveShiftSwap,
  getAllRotasUnfiltered,
  getActiveRotas,
  getOldRotas
} from '../utils/rotaApi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import { buildApiUrl } from '../utils/apiConfig';
import LoadingScreen from '../components/LoadingScreen';
import { DatePicker } from '../components/ui/date-picker';
import MUITimePicker from '../components/MUITimePicker';
import ConfirmDialog from '../components/ConfirmDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import LeaveCalendar from '../components/LeaveManagement/LeaveCalendar';
import { formatDateDDMMYY, getShortDayName } from '../utils/dateFormatter';
import dayjs from 'dayjs';

const RotaShiftManagement = () => {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState(null);
  const [showShiftDetails, setShowShiftDetails] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [rotaTab, setRotaTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal state
  const [assignmentType, setAssignmentType] = useState('employee'); // 'employee' or 'team'
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  // Initialize filters from localStorage or use defaults
  const getInitialFilters = () => {
    try {
      const savedFilters = localStorage.getItem('rotaShiftFilters');
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        console.log('📂 Loaded filters from localStorage:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Error loading filters from localStorage:', error);
    }

    // Default filters - show all shifts (2 year range)
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1); // 1 year ago

    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // 1 year ahead

    const defaultFilters = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      employeeId: '',
      location: 'all',
      workType: 'all',
      status: ''
    };
    console.log('📂 Using default filters (2 year range):', defaultFilters);
    return defaultFilters;
  };

  const [filters, setFilters] = useState(getInitialFilters);
  const [teamFilter, setTeamFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all'); // 'all', 'last7', 'last30'
  const [shiftNameFilter, setShiftNameFilter] = useState([]);
  const [formData, setFormData] = useState({
    employeeIds: [], // Array for multiple employee selection
    teamIds: [], // Array for multiple team selection
    dateRange: [], // Array for date range [start, end]
    shiftName: '',
    startTime: '09:00',
    endTime: '17:00',
    location: 'Office',
    workType: 'Regular',
    breakDuration: 60,
    notes: ''
  });

  function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  function getFriday(date) {
    const monday = getMonday(date);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return friday;
  }

  // Get employees filtered by selected team for dropdown
  const getFilteredEmployeesForDropdown = () => {
    if (teamFilter === 'all') {
      return employees;
    }
    
    // Find the selected team
    const selectedTeam = teams.find(t => (t._id || t.id) === teamFilter);
    if (!selectedTeam || !selectedTeam.members) {
      return employees;
    }
    
    // Filter employees who are members of the selected team
    return employees.filter(emp => {
      const empId = emp.id || emp._id;
      return selectedTeam.members.some(memberId => {
        const memberIdStr = typeof memberId === 'object' ? (memberId._id || memberId.id) : memberId;
        return memberIdStr?.toString() === empId?.toString();
      });
    });
  };

  // Get filtered shifts based on team, employee, and date range filters
  const getFilteredShifts = () => {
    let filtered = [...shifts];
    
    // Filter by date range (UK timezone)
    if (dateRangeFilter !== 'all') {
      const now = new Date();
      let startDate = new Date();
      
      if (dateRangeFilter === 'last7') {
        startDate.setDate(now.getDate() - 7);
      } else if (dateRangeFilter === 'last30') {
        startDate.setDate(now.getDate() - 30);
      }
      
      filtered = filtered.filter(shift => {
        const shiftStartDate = shift.startDate ? new Date(shift.startDate) : null;
        const shiftEndDate = shift.endDate ? new Date(shift.endDate) : null;
        
        // Check if startDate OR endDate falls within the selected period
        return (
          (shiftStartDate && shiftStartDate >= startDate && shiftStartDate <= now) ||
          (shiftEndDate && shiftEndDate >= startDate && shiftEndDate <= now)
        );
      });
    }
    
    // Filter by team
    if (teamFilter !== 'all') {
      const selectedTeam = teams.find(t => (t._id || t.id) === teamFilter);
      if (selectedTeam && selectedTeam.members) {
        filtered = filtered.filter(shift => {
          const assigned = Array.isArray(shift.assignedEmployees) ? shift.assignedEmployees : [];
          const assignedIds = new Set(assigned.map(a => (a.employeeId || '').toString()));
          return selectedTeam.members.some(memberId => {
            const memberIdStr = typeof memberId === 'object' ? (memberId._id || memberId.id) : memberId;
            return memberIdStr && assignedIds.has(memberIdStr.toString());
          });
        });
      }
    }
    
    // Filter by employee
    if (employeeFilter !== 'all') {
      filtered = filtered.filter(shift => {
        const assigned = Array.isArray(shift.assignedEmployees) ? shift.assignedEmployees : [];
        return assigned.some(a => (a.employeeId || '').toString() === employeeFilter);
      });
    }

    // Filter by shift name (multi-select)
    if (Array.isArray(shiftNameFilter) && shiftNameFilter.length > 0) {
      const selected = new Set(shiftNameFilter.map(v => (v || '').toString()));
      filtered = filtered.filter(shift => {
        const name = (shift.shiftName || '').toString();
        return selected.has(name);
      });
    }
    
    return filtered;
  };

  const formatDateRangeDisplay = (startDate, endDate) => {
    if (!startDate && !endDate) return '-';
    const startStr = startDate ? formatDateDDMMYY(startDate) : '';
    const endStr = endDate ? formatDateDDMMYY(endDate) : '';
    if (startStr && endStr && startStr !== endStr) return `${startStr} → ${endStr}`;
    return startStr || endStr;
  };

  const getEmployeeDisplay = (employee) => {
    const id = (employee?.employeeId || '').toString();
    const fromDirectory = id ? employees.find(e => (e.id || e._id)?.toString() === id) : null;
    const employeeName = employee?.employeeName || (fromDirectory ? `${fromDirectory.firstName} ${fromDirectory.lastName}` : '') || 'Employee';
    const email = employee?.email || fromDirectory?.email || '';
    return { employeeName, email, employeeId: id };
  };

  const MiniCalendar = ({ startDate, endDate }) => {
    const start = startDate ? dayjs(startDate) : null;
    const end = endDate ? dayjs(endDate) : null;

    const months = [];
    if (start && end) {
      const startMonth = start.startOf('month');
      const endMonth = end.startOf('month');
      months.push(startMonth);
      if (!startMonth.isSame(endMonth, 'month')) months.push(endMonth);
    } else if (start) {
      months.push(start.startOf('month'));
    } else {
      months.push(dayjs().startOf('month'));
    }

    const isInRange = (d) => {
      if (!start || !end) return false;
      return (d.isAfter(start, 'day') || d.isSame(start, 'day')) && (d.isBefore(end, 'day') || d.isSame(end, 'day'));
    };

    const buildDays = (month) => {
      const gridStart = month.startOf('month').startOf('week');
      const gridEnd = month.endOf('month').endOf('week');
      const days = [];
      let cur = gridStart;
      while (cur.isBefore(gridEnd) || cur.isSame(gridEnd, 'day')) {
        days.push(cur);
        cur = cur.add(1, 'day');
      }
      return days;
    };

    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: months.length === 2 ? '1fr 1fr' : '1fr', gap: '12px' }}>
        {months.map((month, mi) => {
          const days = buildDays(month);
          return (
            <div key={mi} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827', marginBottom: '10px', textAlign: 'center' }}>
                {month.format('MMMM YYYY')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
                {weekDays.map(wd => (
                  <div key={wd} style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textAlign: 'center' }}>{wd}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                {days.map((d, i) => {
                  const inMonth = d.isSame(month, 'month');
                  const active = isInRange(d);
                  return (
                    <div
                      key={i}
                      style={{
                        height: '26px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: active ? '700' : '500',
                        color: !inMonth ? '#9ca3af' : active ? '#1d4ed8' : '#374151',
                        background: active ? '#eff6ff' : 'transparent',
                        position: 'relative'
                      }}
                    >
                      {d.format('D')}
                      {active && (
                        <div style={{ position: 'absolute', bottom: '4px', width: '4px', height: '4px', borderRadius: '999px', background: '#3b82f6' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    console.log('🔄 useEffect triggered - filters changed:', filters);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.startDate, filters.endDate, filters.employeeId, filters.location, filters.workType, filters.status, rotaTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('🔄 Fetching rota data...');

      // Fetch employees from EmployeeHub (userType='employee') for shift assignment
      const employeesResponse = await axios.get(
        buildApiUrl('/employees/with-clock-status'),
        { withCredentials: true }
      );

      // Fetch teams
      const teamsResponse = await axios.get(
        buildApiUrl('/teams'),
        { withCredentials: true }
      );

      console.log('🔍 Fetching with filters:', filters);

      const [shiftsRes, statsRes] = await Promise.all([
        getGroupedShiftAssignments({ ...filters, tab: rotaTab }),
        getShiftStatistics(filters.startDate, filters.endDate)
      ]);

      console.log('📋 Employees Response:', employeesResponse.data);
      console.log('👥 Teams Response:', teamsResponse.data);
      console.log('📅 Shifts Response:', shiftsRes);
      console.log('📊 Total shifts received:', shiftsRes.data?.length || 0);

      // Set teams data
      if (teamsResponse.data && teamsResponse.data.success) {
        setTeams(teamsResponse.data.data || []);
        console.log('✅ Loaded teams:', teamsResponse.data.data?.length || 0);
      }

      if (shiftsRes.success) {
        console.log('✅ Setting', shiftsRes.data?.length || 0, 'grouped shifts to state');
        setShifts(shiftsRes.data || []);
        setCurrentPage(1);
      } else {
        console.warn('⚠️ Shifts fetch unsuccessful:', shiftsRes);
        setShifts([]);
      }
      if (statsRes.success) setStatistics(statsRes.data);

      // Build comprehensive employee list from EmployeeHub AND shifts
      const employeeList = [];
      const employeeIds = new Set();

      // First, add all employees from EmployeeHub (userType='employee')
      if (employeesResponse.data?.success && employeesResponse.data.data) {
        employeesResponse.data.data.forEach(employee => {
          const idString = employee.id || employee._id;
          if (!idString) return;
          if (employeeIds.has(idString)) return;
          employeeList.push({
            id: idString,
            _id: idString,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            role: employee.role || 'employee',
            vtid: employee.vtid,
            name: `${employee.firstName} ${employee.lastName}`
          });
          employeeIds.add(idString);
        });
      }

      console.log(`✅ Loaded ${employeeList.length} total employees (from EmployeeHub roster)`);
      console.log('📋 Employee IDs:', employeeList.map(e => ({ name: e.name, id: e.id, role: e.role })));
      setEmployees(employeeList);
    } catch (error) {
      console.error('❌ Fetch data error:', error);
      toast.error(error.message || 'Failed to load data');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.employeeIds.length === 0 || formData.dateRange.length !== 2) {
      toast.warning('Please select employees and date range');
      return;
    }

    setLoading(true);
    try {
      // Create individual shift assignments for each date in the range
      const start = dayjs(formData.dateRange[0]);
      const end = dayjs(formData.dateRange[1]);
      const startDateStr = start.format('YYYY-MM-DD');
      const endDateStr = end.format('YYYY-MM-DD');
      const groupId = (typeof crypto !== 'undefined' && crypto?.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const dates = [];

      // Generate all dates in the range
      let currentDate = start.startOf('day');
      while (currentDate.isBefore(end) || currentDate.isSame(end)) {
        dates.push(currentDate.format('YYYY-MM-DD'));
        currentDate = currentDate.add(1, 'day');
      }

      console.log('📤 Assigning shifts for date range:', { startDate: formData.dateRange[0], endDate: formData.dateRange[1], totalDates: dates.length, employees: formData.employeeIds.length });

      // Create shift assignments for all dates and all selected employees
      const shiftPromises = [];
      for (const employeeId of formData.employeeIds) {
        for (const date of dates) {
          const shiftData = {
            employeeId,
            shiftName: formData.shiftName,
            date: date,
            groupId,
            startDate: startDateStr,
            endDate: endDateStr,
            startTime: formData.startTime,
            endTime: formData.endTime,
            location: formData.location,
            workType: formData.workType,
            breakDuration: formData.breakDuration,
            notes: formData.notes
          };
          shiftPromises.push(assignShift(shiftData));
        }
      }

      const results = await Promise.all(shiftPromises);
      const successCount = results.filter(r => r.success).length;

      if (successCount > 0) {
        toast.success(`Successfully assigned ${successCount} shifts to ${formData.employeeIds.length} employee(s)`);
        setShowModal(false);
        resetModalState();
        await fetchData();
      } else {
        toast.error('Failed to assign any shifts');
      }
    } catch (error) {
      console.error('❌ Assign shift error:', error);
      toast.error(error.message || 'Failed to assign shifts');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShift = async () => {
    setLoading(true);
    try {
      const shift = shiftToDelete;
      if (!shift) {
        toast.error('No shift selected');
        return;
      }

      let response;
      if (shift.groupId) {
        response = await deleteShiftAssignmentGroup(shift.groupId);
      } else if (Array.isArray(shift.assignmentIds) && shift.assignmentIds.length > 0) {
        const results = await Promise.all(shift.assignmentIds.map(id => deleteShiftAssignment(id)));
        response = { success: results.some(r => r?.success) };
      } else {
        response = await deleteShiftAssignment(shift._id);
      }

      if (response.success) {
        toast.success('Shift deleted successfully');
        setShowDeleteDialog(false);
        setShiftToDelete(null);
        fetchData();
      }
    } catch (error) {
      console.error('Delete shift error:', error);
      toast.error(error.message || 'Failed to delete shift');
    } finally {
      setLoading(false);
    }
  };

  // Handle team selection
  const handleTeamSelect = (teamId) => {
    const team = teams.find(t => t._id === teamId);
    setSelectedTeam(team);

    if (team && team.members) {
      // Get team members from the team's members array
      setTeamMembers(team.members || []);
    } else {
      setTeamMembers([]);
    }
  };

  // Handle team shift assignment
  const handleTeamSubmit = async (e) => {
    e.preventDefault();

    if (formData.teamIds.length === 0 || formData.dateRange.length !== 2) {
      toast.warning('Please select teams and date range');
      return;
    }

    setLoading(true);
    try {
      // Create individual shift assignments for each date in the range and each team
      const start = dayjs(formData.dateRange[0]);
      const end = dayjs(formData.dateRange[1]);
      const startDateStr = start.format('YYYY-MM-DD');
      const endDateStr = end.format('YYYY-MM-DD');
      const groupId = (typeof crypto !== 'undefined' && crypto?.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const dates = [];

      // Generate all dates in the range
      let currentDate = start.startOf('day');
      while (currentDate.isBefore(end) || currentDate.isSame(end)) {
        dates.push(currentDate.format('YYYY-MM-DD'));
        currentDate = currentDate.add(1, 'day');
      }

      console.log('📤 Assigning shifts for date range:', { startDate: formData.dateRange[0], endDate: formData.dateRange[1], totalDates: dates.length, teams: formData.teamIds.length });

      // Create shift assignments for all dates and all selected teams
      const shiftPromises = [];
      for (const teamId of formData.teamIds) {
        const team = teams.find(t => t._id === teamId);
        if (team && team.members) {
          for (const member of team.members) {
            for (const date of dates) {
              const shiftData = {
                employeeId: member._id || member.id,
                shiftName: formData.shiftName,
                date: date,
                groupId,
                startDate: startDateStr,
                endDate: endDateStr,
                startTime: formData.startTime,
                endTime: formData.endTime,
                location: formData.location,
                workType: formData.workType,
                breakDuration: formData.breakDuration,
                notes: formData.notes
              };
              shiftPromises.push(assignShift(shiftData));
            }
          }
        }
      }

      const results = await Promise.all(shiftPromises);
      const successCount = results.filter(r => r.success).length;

      if (successCount > 0) {
        toast.success(`Successfully assigned ${successCount} shifts to ${formData.teamIds.length} team(s)`);
        setShowModal(false);
        resetModalState();
        await fetchData();
      } else {
        toast.error('Failed to assign any shifts');
      }
    } catch (error) {
      console.error('❌ Team assign shift error:', error);
      toast.error(error.message || 'Failed to assign shifts to teams');
    } finally {
      setLoading(false);
    }
  };

  // Reset modal state
  const resetModalState = () => {
    setAssignmentType('employee');
    setSelectedTeam(null);
    setTeamMembers([]);
    setFormData({
      employeeIds: [],
      teamIds: [],
      dateRange: [],
      shiftName: '',
      startTime: '09:00',
      endTime: '17:00',
      location: 'Office',
      workType: 'Regular',
      breakDuration: 60,
      notes: ''
    });
  };

  const getLocationColor = (location) => {
    const colors = {
      'Office': '#3b82f6',
      'Home': '#10b981',
      'Field': '#f59e0b',
      'Client Site': '#8b5cf6'
    };
    return colors[location] || '#6b7280';
  };

  /**
   * Format date to UK format: "Fri, 24 Oct 2025"
   */
  const formatUKDate = (dateString) => {
    if (!dateString) return '';
    return `${getShortDayName(dateString)}, ${formatDateDDMMYY(dateString)}`;
  };

  /**
   * Format time to UK format: "09:03 AM"
   */
  const formatUKTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Scheduled': { bg: '#f3f4f6', text: '#374151', icon: '⚪' },
      'In Progress': { bg: '#d1fae5', text: '#065f46', icon: '🟢' },
      'On Break': { bg: '#fef3c7', text: '#92400e', icon: '🟡' },
      'Completed': { bg: '#dbeafe', text: '#1e40af', icon: '✅' },
      'Missed': { bg: '#fee2e2', text: '#991b1b', icon: '🔴' },
      'Swapped': { bg: '#fef3c7', text: '#92400e', icon: '🔄' },
      'Cancelled': { bg: '#f3f4f6', text: '#6b7280', icon: '⛔' }
    };
    const style = styles[status] || styles['Scheduled'];
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
        background: style.bg,
        color: style.text
      }}>
        {style.icon} {status}
      </span>
    );
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [field]: value };
      // Save to localStorage
      try {
        localStorage.setItem('rotaShiftFilters', JSON.stringify(newFilters));
        console.log('💾 Saved filters to localStorage:', newFilters);
      } catch (error) {
        console.error('Error saving filters to localStorage:', error);
      }
      return newFilters;
    });
  };

  const resetFilters = () => {
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1); // 1 year ago

    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // 1 year ahead

    const defaultFilters = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      employeeId: '',
      location: 'all',
      workType: 'all',
      status: ''
    };
    setFilters(defaultFilters);

    // Save to localStorage
    try {
      localStorage.setItem('rotaShiftFilters', JSON.stringify(defaultFilters));
      console.log('🔄 Reset filters to default (2 year range):', defaultFilters);
    } catch (error) {
      console.error('Error saving filters to localStorage:', error);
    }

    toast.info('Filters reset to show all shifts', { autoClose: 2000 });
  };


  const exportToCSV = () => {
    // Get the SAME filtered data that the table displays
    const visibleShifts = getFilteredShifts();
    
    if (visibleShifts.length === 0) {
      toast.warning('No rotas available to export.');
      return;
    }

    // Transform visible shifts to CSV format - matching table columns exactly
    const csvData = visibleShifts.map((shift) => {
      return [
        shift.shiftName || '',
        formatDateRangeDisplay(shift.startDate, shift.endDate),
        shift.location || '',
        shift.workType || ''
      ];
    });

    const headers = ['Shift Name', 'Date Range', 'Location', 'Work Type'];
    const rows = [headers, ...csvData];

    // Generate CSV content
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    // Filename format: All_Rotas_<yyyy-mm-dd>.csv
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // yyyy-mm-dd format
    const tabName = rotaTab === 'all' ? 'All_Rotas' : (rotaTab === 'old' ? 'Old_Rotas' : 'Active_Rotas');
    link.setAttribute("download", `${tabName}_${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    const tabLabel = rotaTab === 'all' ? 'All' : (rotaTab === 'old' ? 'Old' : 'Active');
    toast.success(`${tabLabel} rotas exported successfully (${visibleShifts.length} rotas)`);
  };

  if (loading && shifts.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Rota & Shift Management
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Assign, manage, and track employee shift schedules
          </p>
        </div>

      {showShiftDetails && selectedShift && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '900px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            zIndex: 51
          }}>
            <button
              type="button"
              onClick={() => {
                setShowShiftDetails(false);
                setSelectedShift(null);
              }}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                color: '#374151',
                fontSize: '18px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              ×
            </button>

            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#111827', marginBottom: '4px' }}>
                {selectedShift.shiftName || 'Shift Details'}
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '600' }}>
                {(selectedShift.location || '-') + ' • ' + (selectedShift.workType || '-')}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#111827', marginBottom: '12px' }}>Shift Meta Information</div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: '10px', columnGap: '12px', fontSize: '13px' }}>
                  <div style={{ color: '#6b7280', fontWeight: '700' }}>Shift Name</div>
                  <div style={{ color: '#111827', fontWeight: '700' }}>{selectedShift.shiftName || '-'}</div>

                  <div style={{ color: '#6b7280', fontWeight: '700' }}>Date Range</div>
                  <div style={{ color: '#111827', fontWeight: '700' }}>{formatDateRangeDisplay(selectedShift.startDate, selectedShift.endDate)}</div>

                  <div style={{ color: '#6b7280', fontWeight: '700' }}>Start – End</div>
                  <div style={{ color: '#111827', fontWeight: '700' }}>{formatUKTime(selectedShift.startTime)} – {formatUKTime(selectedShift.endTime)}</div>

                  <div style={{ color: '#6b7280', fontWeight: '700' }}>Location</div>
                  <div style={{ color: '#111827', fontWeight: '700' }}>{selectedShift.location || '-'}</div>

                  <div style={{ color: '#6b7280', fontWeight: '700' }}>Work Type</div>
                  <div style={{ color: '#111827', fontWeight: '700' }}>{selectedShift.workType || '-'}</div>

                  <div style={{ color: '#6b7280', fontWeight: '700' }}>Assigned By</div>
                  <div style={{ color: '#111827', fontWeight: '700' }}>
                    {selectedShift.assignedBy 
                      ? `${selectedShift.assignedBy.firstName} ${selectedShift.assignedBy.lastName}`
                      : '-'
                    }
                  </div>
                </div>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#111827', marginBottom: '12px' }}>Mini Calendar</div>
                <MiniCalendar startDate={selectedShift.startDate} endDate={selectedShift.endDate} />
              </div>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>Assigned Employees</div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280' }}>
                  {(Array.isArray(selectedShift.assignedEmployees) ? selectedShift.assignedEmployees.length : 0)} employees
                </div>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '6px' }}>
                {(Array.isArray(selectedShift.assignedEmployees) ? selectedShift.assignedEmployees : []).length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>No employees assigned</div>
                ) : (
                  (selectedShift.assignedEmployees || []).map((emp, idx) => {
                    const { employeeName, email, employeeId } = getEmployeeDisplay(emp);
                    const initials = employeeName.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || 'E';
                    return (
                      <div key={`${employeeId}-${idx}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #f3f4f6',
                        marginBottom: '10px',
                        background: '#ffffff'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '999px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: '800'
                          }}>
                            {initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {employeeName}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {email || employeeId}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#374151' }}>
                          {formatUKTime(emp.startTime || selectedShift.startTime)} – {formatUKTime(emp.endTime || selectedShift.endTime)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

        {statistics && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Total Shifts</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#111827' }}>{statistics.totalShifts}</div>
            </div>
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Total Hours</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#111827' }}>{statistics.totalHours}</div>
            </div>
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Employees</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#111827' }}>{statistics.uniqueEmployees}</div>
            </div>
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Office</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#3b82f6' }}>{statistics.byLocation.Office}</div>
            </div>
          </div>
        )}

        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => { setRotaTab('all'); setCurrentPage(1); }}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: rotaTab === 'all' ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                background: rotaTab === 'all' ? '#eff6ff' : '#ffffff',
                color: rotaTab === 'all' ? '#1d4ed8' : '#374151',
                fontSize: '14px',
                fontWeight: rotaTab === 'all' ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              All Rotas
            </button>
            <button
              type="button"
              onClick={() => { setRotaTab('active'); setCurrentPage(1); }}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: rotaTab === 'active' ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                background: rotaTab === 'active' ? '#eff6ff' : '#ffffff',
                color: rotaTab === 'active' ? '#1d4ed8' : '#374151',
                fontSize: '14px',
                fontWeight: rotaTab === 'active' ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Active Rotas
            </button>
            <button
              type="button"
              onClick={() => { setRotaTab('old'); setCurrentPage(1); }}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: rotaTab === 'old' ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                background: rotaTab === 'old' ? '#eff6ff' : '#ffffff',
                color: rotaTab === 'old' ? '#1d4ed8' : '#374151',
                fontSize: '14px',
                fontWeight: rotaTab === 'old' ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Old Rotas
            </button>
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <DatePicker
                label="Start Date"
                value={filters.startDate ? dayjs(filters.startDate) : null}
                onChange={(date) => handleFilterChange('startDate', date ? date.format('YYYY-MM-DD') : '')}
              />
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <DatePicker
                label="End Date"
                value={filters.endDate ? dayjs(filters.endDate) : null}
                onChange={(date) => handleFilterChange('endDate', date ? date.format('YYYY-MM-DD') : '')}
                minDate={filters.startDate ? dayjs(filters.startDate) : undefined}
              />
            </div>
            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Location
              </label>
              <Select
                value={filters.location}
                onValueChange={(value) => handleFilterChange('location', value)}
              >
                <SelectTrigger style={{ width: '100%', padding: '10px 12px' }}>
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  <SelectItem value="Office">Office</SelectItem>
                  <SelectItem value="Home">Home</SelectItem>
                  <SelectItem value="Field">Field</SelectItem>
                  <SelectItem value="Client Site">Client Site</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Work Type
              </label>
              <Select
                value={filters.workType}
                onValueChange={(value) => handleFilterChange('workType', value)}
              >
                <SelectTrigger style={{ width: '100%', padding: '10px 12px' }}>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Regular">Regular</SelectItem>
                  <SelectItem value="Overtime">Overtime</SelectItem>
                  <SelectItem value="Weekend overtime">Weekend Overtime</SelectItem>
                  <SelectItem value="Client side overtime">Client Side Overtime</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Filter by date range
              </label>
              <Select
                value={dateRangeFilter}
                onValueChange={(value) => {
                  setDateRangeFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger style={{ width: '100%', padding: '10px 12px' }}>
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="last7">Last 7 days</SelectItem>
                  <SelectItem value="last30">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Team
              </label>
              <Select
                value={teamFilter}
                onValueChange={(value) => {
                  setTeamFilter(value);
                  setEmployeeFilter('all');
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger style={{ width: '100%', padding: '10px 12px' }}>
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team._id || team.id} value={team._id || team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div style={{ flex: '1', minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Employee
              </label>
              <Select
                value={employeeFilter}
                onValueChange={(value) => {
                  setEmployeeFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger style={{ width: '100%', padding: '10px 12px' }}>
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {getFilteredEmployeesForDropdown().map(emp => (
                    <SelectItem key={emp.id || emp._id} value={emp.id || emp._id}>
                      {emp.firstName} {emp.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div style={{ flex: '1', minWidth: '220px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Shift Name
              </label>
              <MultiSelectDropdown
                options={Array.from(new Set((shifts || []).map(s => (s.shiftName || '').toString().trim()).filter(Boolean))).sort().map(name => ({
                  value: name,
                  label: name
                }))}
                selectedValues={shiftNameFilter}
                onChange={(values) => {
                  setShiftNameFilter(values);
                  setCurrentPage(1);
                }}
                placeholder="Select shift name(s)..."
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <button
                onClick={() => {
                  setTeamFilter('all');
                  setEmployeeFilter('all');
                  setDateRangeFilter('all');
                  setShiftNameFilter([]);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Clear Filters
              </button>
              <button
                onClick={() => setShowModal(true)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#3b82f6',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                }}
              >
                + Assign Shift
              </button>
              <button
                onClick={exportToCSV}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151', width: '60px' }}>SI No.</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Shift Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Date Range</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Location</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Work Type</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredShifts().length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                      {teamFilter !== 'all' || employeeFilter !== 'all' 
                        ? 'No shifts found for the selected filters.'
                        : (rotaTab === 'all' ? 'No rotas found.' : (rotaTab === 'active' ? 'No active rotas today.' : 'No old rotas found.'))}
                    </td>
                  </tr>
                ) : (
                  getFilteredShifts().slice((currentPage - 1) * pageSize, currentPage * pageSize).map((shift, index) => {
                    return (
                      <tr
                        key={shift._id}
                        style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedShift(shift);
                          setShowShiftDetails(true);
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827', fontWeight: '600' }}>
                          {(currentPage - 1) * pageSize + index + 1}
                        </td>
                        <td
                          style={{ padding: '12px 16px', fontSize: '14px', color: '#111827', fontWeight: '600' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShift(shift);
                            setShowShiftDetails(true);
                          }}
                        >
                          <span style={{ color: '#1d4ed8' }}>{shift.shiftName || '-'}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                          {formatDateRangeDisplay(shift.startDate, shift.endDate)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            background: getLocationColor(shift.location) + '20',
                            color: getLocationColor(shift.location)
                          }}>
                            {shift.location}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>
                          {shift.workType}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShift(shift);
                                setShowShiftDetails(true);
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                background: '#ffffff',
                                color: '#374151',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              View
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShiftToDelete(shift);
                                setShowDeleteDialog(true);
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #fca5a5',
                                background: '#ffffff',
                                color: '#dc2626',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {getFilteredShifts().length > 0 && (
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #f3f4f6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                Showing {Math.min((currentPage - 1) * pageSize + 1, getFilteredShifts().length)} to {Math.min(currentPage * pageSize, getFilteredShifts().length)} of {getFilteredShifts().length} rotas
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: currentPage === 1 ? '#f9fafb' : '#ffffff',
                    color: currentPage === 1 ? '#9ca3af' : '#374151',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {Array.from({ length: Math.ceil(getFilteredShifts().length / pageSize) }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: currentPage === page ? '1px solid #3b82f6' : '1px solid #d1d5db',
                        background: currentPage === page ? '#eff6ff' : '#ffffff',
                        color: currentPage === page ? '#1d4ed8' : '#374151',
                        fontSize: '14px',
                        fontWeight: currentPage === page ? '600' : '500',
                        cursor: 'pointer',
                        minWidth: '36px'
                      }}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(getFilteredShifts().length / pageSize), prev + 1))}
                  disabled={currentPage >= Math.ceil(getFilteredShifts().length / pageSize)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: currentPage >= Math.ceil(getFilteredShifts().length / pageSize) ? '#f9fafb' : '#ffffff',
                    color: currentPage >= Math.ceil(getFilteredShifts().length / pageSize) ? '#9ca3af' : '#374151',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: currentPage >= Math.ceil(getFilteredShifts().length / pageSize) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '700px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            zIndex: 51
          }}>
            {/* Modal Header */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
                Assign New Shift
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Assign shifts to individual employees or entire teams
              </p>
            </div>

            {/* Tab Navigation */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #e5e7eb',
              marginBottom: '24px'
            }}>
              <button
                type="button"
                onClick={() => setAssignmentType('employee')}
                style={{
                  padding: '12px 24px',
                  borderBottom: assignmentType === 'employee' ? '2px solid #3b82f6' : '2px solid transparent',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  fontSize: '16px',
                  fontWeight: assignmentType === 'employee' ? '600' : '500',
                  color: assignmentType === 'employee' ? '#3b82f6' : '#6b7280',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                👤 Employee
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType('team')}
                style={{
                  padding: '12px 24px',
                  borderBottom: assignmentType === 'team' ? '2px solid #3b82f6' : '2px solid transparent',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  fontSize: '16px',
                  fontWeight: assignmentType === 'team' ? '600' : '500',
                  color: assignmentType === 'team' ? '#3b82f6' : '#6b7280',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                👥 Teams
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={(e) => e.preventDefault()}>
              {/* Employee/Team Selection */}
              {assignmentType === 'employee' ? (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    Employees <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <MultiSelectDropdown
                    options={employees.map(emp => ({
                      value: emp.id || emp._id,
                      label: `${emp.firstName} ${emp.lastName}`,
                      subLabel: emp.email
                    }))}
                    selectedValues={formData.employeeIds}
                    onChange={(employeeIds) => setFormData({ ...formData, employeeIds })}
                    placeholder="Select employees..."
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    Teams <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <MultiSelectDropdown
                    options={teams.map(team => ({
                      value: team._id,
                      label: team.name,
                      subLabel: `${team.members?.length || 0} members`
                    }))}
                    selectedValues={formData.teamIds}
                    onChange={(teamIds) => {
                      setFormData({ ...formData, teamIds });
                      // Update selectedTeam and teamMembers for display
                      if (teamIds.length === 1) {
                        const team = teams.find(t => t._id === teamIds[0]);
                        setSelectedTeam(team);
                        setTeamMembers(team?.members || []);
                      } else {
                        setSelectedTeam(null);
                        setTeamMembers([]);
                      }
                    }}
                    placeholder="Select teams..."
                  />

                  {/* Team Members Display */}
                  {selectedTeam && teamMembers.length > 0 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '16px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        Team Members ({teamMembers.length})
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                        {teamMembers.map((member, index) => (
                          <div key={index} style={{
                            padding: '8px 12px',
                            background: '#ffffff',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#374151',
                            border: '1px solid #e5e7eb'
                          }}>
                            {member.firstName} {member.lastName}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  Shift Name
                </label>
                <input
                  type="text"
                  value={formData.shiftName}
                  onChange={(e) => setFormData({ ...formData, shiftName: e.target.value })}
                  placeholder="Enter shift name..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Date Range Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Date Range <span style={{ color: '#dc2626' }}>*</span></label>
                <div style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  background: '#f9fafb'
                }}>
                  <LeaveCalendar
                    startDate={formData.dateRange[0]}
                    endDate={formData.dateRange[1]}
                    onDateSelect={(start, end) => {
                      // Store partial range ([start]) to allow visual selection of first date
                      const dateRange = start ? (end ? [start, end] : [start]) : [];
                      setFormData({ ...formData, dateRange });
                    }}
                  />
                  {formData.dateRange && formData.dateRange.length === 2 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#eff6ff',
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe',
                      fontSize: '14px',
                      color: '#1e40af',
                      fontWeight: '500'
                    }}>
                      📅 {formData.dateRange[0].toLocaleDateString('en-GB')} — {formData.dateRange[1].toLocaleDateString('en-GB')}
                    </div>
                  )}
                </div>
              </div>

              {/* Time Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <MUITimePicker
                    label="Start Time"
                    value={formData.startTime}
                    onChange={(time) => {
                      if (time) {
                        setFormData({ ...formData, startTime: time.format('HH:mm') });
                      } else {
                        setFormData({ ...formData, startTime: '' });
                      }
                    }}
                  />
                </div>
                <div>
                  <MUITimePicker
                    label="End Time"
                    value={formData.endTime}
                    onChange={(time) => {
                      if (time) {
                        setFormData({ ...formData, endTime: time.format('HH:mm') });
                      } else {
                        setFormData({ ...formData, endTime: '' });
                      }
                    }}
                  />
                </div>
              </div>

              {/* Location and Work Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    Location
                  </label>
                  <Select
                    value={formData.location}
                    onValueChange={(value) => setFormData({ ...formData, location: value })}
                  >
                    <SelectTrigger style={{ width: '100%', padding: '12px' }}>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      <SelectItem value="Office">Work From Office</SelectItem>
                      <SelectItem value="Home">Work From Home</SelectItem>
                      <SelectItem value="Field">Field</SelectItem>
                      <SelectItem value="Client Site">Client Site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    Work Type
                  </label>
                  <Select
                    value={formData.workType}
                    onValueChange={(value) => setFormData({ ...formData, workType: value })}
                  >
                    <SelectTrigger style={{ width: '100%', padding: '12px' }}>
                      <SelectValue placeholder="Select work type" />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      <SelectItem value="Regular">Regular</SelectItem>
                      <SelectItem value="Overtime">Overtime</SelectItem>
                      <SelectItem value="Weekend overtime">Weekend Overtime</SelectItem>
                      <SelectItem value="Client side overtime">Client Side Overtime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Break Duration */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  Break Duration (minutes)
                </label>
                <input
                  type="number"
                  value={formData.breakDuration}
                  onChange={(e) => setFormData({ ...formData, breakDuration: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetModalState();
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={assignmentType === 'employee' ? handleSubmit : handleTeamSubmit}
                  disabled={loading}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: loading ? '#9ca3af' : '#3b82f6',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading
                    ? (assignmentType === 'employee' ? 'Assigning...' : 'Assigning to Team...')
                    : (assignmentType === 'employee' ? 'Assign Shift' : `Assign to ${teamMembers.length} Members`)
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Shift Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Shift"
        description="Are you sure you want to delete this shift? This action cannot be undone."
        onConfirm={handleDeleteShift}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
};

export default RotaShiftManagement;
