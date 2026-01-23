import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { buildApiUrl } from '../utils/apiConfig';
import { toast, ToastContainer } from 'react-toastify';
import { DatePicker } from '../components/ui/date-picker';
import MUITimePicker from '../components/MUITimePicker';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isBetween from 'dayjs/plugin/isBetween';
import 'react-toastify/dist/ReactToastify.css';
import { getTimeEntries, exportTimeEntries } from '../utils/clockApi';
import { assignShift } from '../utils/rotaApi';
import axios from 'axios';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(isBetween);

const TimeHistory = () => {
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    clockIn: '',
    clockOut: '',
    location: '',
    workType: '',
    breaks: []
  });
  const [filters, setFilters] = useState({
    employeeSearch: '',
    locationSearch: '',
    dateRange: {
      start: getDefaultStartDate(),
      end: new Date().toISOString().split('T')[0]
    }
  });
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '17:00',
    location: 'Office',
    workType: 'Regular',
    breakDuration: 60,
    notes: ''
  });

  function getDefaultStartDate() {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }

  useEffect(() => {
    fetchTimeEntries();
    fetchEmployees();
  }, [filters.dateRange]);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(
        buildApiUrl('/employees/with-clock-status'),
        { withCredentials: true }
      );
      console.log('📋 Raw employees response:', response.data);
      
      if (response.data?.success) {
        const employeeList = (response.data.data || [])
          .map(emp => ({
            id: emp.id,
            _id: emp._id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email,
            vtid: emp.vtid,
            name: `${emp.firstName} ${emp.lastName}`
          }));

        console.log(`✅ Loaded ${employeeList.length} employees from EmployeeHub`);
        setEmployees(employeeList);
      }
    } catch (error) {
      console.error('❌ Fetch employees error:', error);
      toast.error('Failed to fetch employees');
    }
  };

  const fetchTimeEntries = async () => {
    setLoading(true);
    try {
      const response = await getTimeEntries(filters.dateRange.start, filters.dateRange.end);
      if (response.success) {
        setTimeEntries(response.data || []);
      } else {
        setTimeEntries([]);
      }
    } catch (error) {
      console.error('Fetch time entries error:', error);
      toast.error('Failed to fetch time entries');
      setTimeEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignShift = async (e) => {
    e.preventDefault();
    
    if (!formData.employeeId || !formData.startDate || !formData.endDate) {
      toast.warning('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // Create individual shift assignments for each date in the range
      const start = dayjs(formData.startDate);
      const end = dayjs(formData.endDate);
      const dates = [];
      
      // Generate all dates in the range
      let currentDate = start.startOf('day');
      while (currentDate.isBefore(end) || currentDate.isSame(end)) {
        dates.push(currentDate.format('YYYY-MM-DD'));
        currentDate = currentDate.add(1, 'day');
      }

      console.log('📤 Assigning shifts for date range:', { startDate: formData.startDate, endDate: formData.endDate, totalDates: dates.length });
      
      // Create shift assignments for all dates
      const shiftPromises = dates.map(date => {
        const shiftData = {
          ...formData,
          date: date,
          startDate: undefined,
          endDate: undefined // Remove dateRange from individual shift data
        };
        return assignShift(shiftData);
      });

      const results = await Promise.allSettled(shiftPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

      if (successful > 0) {
        toast.success(`Successfully assigned ${successful} shift${successful > 1 ? 's' : ''}`);
      }
      
      if (failed > 0) {
        toast.warning(`${failed} shift${failed > 1 ? 's' : ''} could not be assigned due to conflicts or errors`);
      }
      
      setShowAssignModal(false);
      setFormData({
        employeeId: '',
        startDate: '',
        endDate: '',
        startTime: '09:00',
        endTime: '17:00',
        location: 'Office',
        workType: 'Regular',
        breakDuration: 60,
        notes: ''
      });
      fetchTimeEntries();
    } catch (error) {
      console.error('❌ Assign shift error:', error);
      toast.error(error.message || 'Failed to assign shifts');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEntry = (entryId) => {
    console.log('🔘 Selecting entry:', entryId);
    setSelectedEntries(prev => {
      const newSelection = prev.includes(entryId) 
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId];
      console.log('📋 Updated selection:', newSelection);
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    if (selectedEntries.length === timeEntries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(timeEntries.map(entry => entry._id));
    }
  };

  const handleEditSelected = () => {
    console.log('✏️ Edit button clicked');
    console.log('📋 Selected entries:', selectedEntries);
    console.log('📊 Total entries:', timeEntries.length);
    
    if (selectedEntries.length !== 1) {
      console.warn('⚠️ Invalid selection count:', selectedEntries.length);
      toast.warning('Please select exactly one entry to edit');
      return;
    }

    const entryToEdit = timeEntries.find(entry => entry._id === selectedEntries[0]);
    console.log('🔍 Entry to edit:', entryToEdit);
    
    if (!entryToEdit) {
      console.error('❌ Entry not found');
      toast.error('Entry not found');
      return;
    }

    setEditingEntry(entryToEdit);
    setEditFormData({
      clockIn: entryToEdit.clockIn || '',
      clockOut: entryToEdit.clockOut || '',
      location: entryToEdit.location || 'Office',
      workType: entryToEdit.workType || 'Regular',
      breaks: entryToEdit.breaks || []
    });
    console.log('✅ Opening edit modal');
    setShowEditModal(true);
  };

  const handleUpdateEntry = async (e) => {
    e.preventDefault();
    
    if (!editingEntry) {
      toast.error('No entry selected for editing');
      return;
    }

    try {
      const response = await axios.put(
        buildApiUrl(`/clock/entry/${editingEntry._id}`),
        editFormData,
        { withCredentials: true }
      );

      if (response.data.success) {
        toast.success('Time entry updated successfully');
        setShowEditModal(false);
        setEditingEntry(null);
        setSelectedEntries([]);
        fetchTimeEntries();
      }
    } catch (error) {
      console.error('Update error:', error);
      toast.error(error.response?.data?.message || 'Failed to update entry');
    }
  };

  const initiateDelete = () => {
    if (selectedEntries.length === 0) {
      toast.warning('Please select entries to delete');
      return;
    }
    setShowDeleteDialog(true);
  };

  const handleDeleteSelected = async () => {
    try {
      const deletePromises = selectedEntries.map(entryId =>
        axios.delete(buildApiUrl(`/clock/entry/${entryId}`), { withCredentials: true })
      );
      
      await Promise.all(deletePromises);
      toast.success(`Successfully deleted ${selectedEntries.length} ${selectedEntries.length === 1 ? 'entry' : 'entries'}`);
      setSelectedEntries([]);
      fetchTimeEntries();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete entries');
    }
  };

  const handleExportCSV = async () => {
    try {
      const csvData = await exportTimeEntries(filters.dateRange.start, filters.dateRange.end);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `time-entries-${filters.dateRange.start}-to-${filters.dateRange.end}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Time entries exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export');
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString("en-GB", {
      timeZone: "Europe/London",
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const calculateShiftHours = (entry) => {
    // Use shiftHours from backend if available
    if (entry.shiftHours) {
      return `${entry.shiftHours} hrs`;
    }
    // Fallback to calculation if shiftId is populated
    if (entry.shiftId && entry.shiftId.startTime && entry.shiftId.endTime) {
      const start = new Date(`2000-01-01T${entry.shiftId.startTime}`);
      const end = new Date(`2000-01-01T${entry.shiftId.endTime}`);
      const hours = ((end - start) / (1000 * 60 * 60)).toFixed(2);
      return `${hours} hrs`;
    }
    return '—';
  };

  const calculateTotalHours = (clockIn, clockOut, breaks = []) => {
    if (!clockIn || !clockOut) return '0 hrs';
    const start = new Date(`2000-01-01T${clockIn}`);
    const end = new Date(`2000-01-01T${clockOut}`);
    let totalMinutes = (end - start) / (1000 * 60);
    breaks.forEach(b => { if (b.duration) totalMinutes -= b.duration; });
    const hours = (totalMinutes / 60).toFixed(2);
    return `${hours} hrs`;
  };

  const calculateOvertime = (entry) => {
    // If no clock out, no overtime yet
    if (!entry.clockIn || !entry.clockOut) return '—';
    
    // Get shift hours - only calculate overtime if shift is assigned
    let shiftHours = 0;
    let hasShift = false;
    
    if (entry.shiftHours) {
      shiftHours = parseFloat(entry.shiftHours);
      hasShift = shiftHours > 0;
    } else if (entry.shiftId && entry.shiftId.startTime && entry.shiftId.endTime) {
      const shiftStart = new Date(`2000-01-01T${entry.shiftId.startTime}`);
      const shiftEnd = new Date(`2000-01-01T${entry.shiftId.endTime}`);
      shiftHours = (shiftEnd - shiftStart) / (1000 * 60 * 60);
      hasShift = shiftHours > 0;
    }
    
    // If no shift assigned, don't calculate overtime
    if (!hasShift) {
      return '—';
    }
    
    // Calculate total hours worked
    const start = new Date(`2000-01-01T${entry.clockIn}`);
    const end = new Date(`2000-01-01T${entry.clockOut}`);
    let totalMinutes = (end - start) / (1000 * 60);
    
    // Subtract breaks
    if (entry.breaks && entry.breaks.length > 0) {
      entry.breaks.forEach(b => { if (b.duration) totalMinutes -= b.duration; });
    }
    
    const hoursWorked = totalMinutes / 60;
    
    // Calculate overtime (hours worked beyond shift hours)
    const overtime = hoursWorked - shiftHours;
    
    if (overtime > 0) {
      return <span style={{ color: '#f97316', fontWeight: '600' }}>{overtime.toFixed(2)} hrs</span>;
    }
    
    return '—';
  };

  const filteredEntries = timeEntries.filter(entry => {
    const fullName = entry.employee ? `${entry.employee.firstName} ${entry.employee.lastName}`.toLowerCase() : '';
    const matchesEmployee = filters.employeeSearch === '' || fullName.includes(filters.employeeSearch.toLowerCase());
    const matchesLocation = filters.locationSearch === '' || entry.location?.toLowerCase().includes(filters.locationSearch.toLowerCase());
    return matchesEmployee && matchesLocation;
  });

  if (loading) return <LoadingScreen />;

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
              Time Entry History
            </h1>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              Last Updated: {new Date().toLocaleString("en-GB", { timeZone: "Europe/London", hour: '2-digit', minute: '2-digit', weekday: 'short', day: '2-digit', month: 'short' })}
            </p>
          </div>
          <button onClick={handleExportCSV} style={{ padding: '10px 20px', background: '#06b6d4', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Export to CSV
          </button>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Filter by employees</label>
              <input type="text" placeholder="Search Employees" value={filters.employeeSearch} onChange={(e) => setFilters(prev => ({ ...prev, employeeSearch: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }} />
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Filter by locations</label>
              <input type="text" placeholder="Select Location" value={filters.locationSearch} onChange={(e) => setFilters(prev => ({ ...prev, locationSearch: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }} />
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <DatePicker
                label="Start Date"
                value={filters.dateRange.start ? dayjs(filters.dateRange.start) : null}
                onChange={(date) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, start: date ? date.format('YYYY-MM-DD') : '' } }))}
              />
            </div>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <DatePicker
                label="End Date"
                value={filters.dateRange.end ? dayjs(filters.dateRange.end) : null}
                onChange={(date) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, end: date ? date.format('YYYY-MM-DD') : '' } }))}
                minDate={filters.dateRange.start ? dayjs(filters.dateRange.start) : undefined}
              />
            </div>
          </div>
        </div>

        {selectedEntries.length > 0 && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#1e40af', fontWeight: '500' }}>
              {selectedEntries.length} {selectedEntries.length === 1 ? 'entry' : 'entries'} selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={handleEditSelected}
                disabled={selectedEntries.length !== 1}
                style={{ 
                  padding: '8px 16px', 
                  background: selectedEntries.length === 1 ? '#3b82f6' : '#9ca3af', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '6px', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  cursor: selectedEntries.length === 1 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Entry
              </button>
              <button 
                onClick={initiateDelete}
                style={{ 
                  padding: '8px 16px', 
                  background: '#dc2626', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '6px', 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Selected
              </button>
            </div>
          </div>
        )}

        <div style={{ background: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb', width: '40px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedEntries.length === filteredEntries.length && filteredEntries.length > 0}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Employee Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Clock In</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Clock Out</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Shift Hours</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Total Hours Worked</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Overtime</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length > 0 ? (
                filteredEntries.map((entry, index) => (
                  <tr key={entry._id || index} style={{ borderBottom: '1px solid #f3f4f6', background: selectedEntries.includes(entry._id) ? '#f0f9ff' : 'transparent' }}>
                    <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedEntries.includes(entry._id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectEntry(entry._id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      {entry.employee ? `${entry.employee.firstName || ''} ${entry.employee.lastName || ''}`.trim() || 'Unknown' : 'Unknown'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      <div>{formatTime(entry.clockIn)}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{formatDate(entry.date)}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      <div>{formatTime(entry.clockOut)}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{formatDate(entry.date)}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      {calculateShiftHours(entry)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827', fontWeight: '600' }}>
                      {calculateTotalHours(entry.clockIn, entry.clockOut, entry.breaks)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                      {calculateOvertime(entry)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>No Time Entries Found</h3>
                    <p style={{ fontSize: '14px', color: '#6b7280' }}>Try adjusting your date range or filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAssignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '32px', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', zIndex: 51 }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '24px' }}>Assign New Shift</h2>
            <form onSubmit={handleAssignShift}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Employee <span style={{ color: '#dc2626' }}>*</span></label>
                <Select value={formData.employeeId} onValueChange={(value) => setFormData({ ...formData, employeeId: value })} required>
                  <SelectTrigger style={{ width: '100%', padding: '12px' }}>
                    <SelectValue placeholder="Select Employee" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} {emp.vtid ? `(${emp.vtid})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Date Range <span style={{ color: '#dc2626' }}>*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <DatePicker
                      label="Start Date"
                      required
                      value={formData.startDate ? dayjs(formData.startDate) : null}
                      onChange={(date) => setFormData({ ...formData, startDate: date ? date.format('YYYY-MM-DD') : '' })}
                    />
                  </div>
                  <div>
                    <DatePicker
                      label="End Date"
                      required
                      value={formData.endDate ? dayjs(formData.endDate) : null}
                      onChange={(date) => setFormData({ ...formData, endDate: date ? date.format('YYYY-MM-DD') : '' })}
                      minDate={formData.startDate ? dayjs(formData.startDate) : undefined}
                    />
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <MUITimePicker
                    label="Start Time"
                    value={formData.startTime}
                    onChange={(time) => setFormData({ ...formData, startTime: time ? time.format('HH:mm') : '' })}
                  />
                </div>
                <div>
                  <MUITimePicker
                    label="End Time"
                    value={formData.endTime}
                    onChange={(time) => setFormData({ ...formData, endTime: time ? time.format('HH:mm') : '' })}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Location</label>
                <Select value={formData.location} onValueChange={(value) => setFormData({ ...formData, location: value })}>
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
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Work Type</label>
                <Select value={formData.workType} onValueChange={(value) => setFormData({ ...formData, workType: value })}>
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
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAssignModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#ffffff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                  Assign Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingEntry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '32px', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', zIndex: 51 }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>Edit Time Entry</h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
              {editingEntry.employee ? `${editingEntry.employee.firstName} ${editingEntry.employee.lastName}` : 'Employee'} - {formatDate(editingEntry.date)}
            </p>
            <form onSubmit={handleUpdateEntry}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Clock In Time</label>
                <MUITimePicker
                  label="Clock In"
                  value={editFormData.clockIn || null}
                  onChange={(time) => setEditFormData({ ...editFormData, clockIn: time ? time.format('HH:mm') : '' })}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Clock Out Time</label>
                <MUITimePicker
                  label="Clock Out"
                  value={editFormData.clockOut || null}
                  onChange={(time) => setEditFormData({ ...editFormData, clockOut: time ? time.format('HH:mm') : '' })}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Location</label>
                <Select 
                  value={editFormData.location} 
                  onValueChange={(value) => setEditFormData({ ...editFormData, location: value })}
                >
                  <SelectTrigger style={{ width: '100%', padding: '12px' }}>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="Office">Office</SelectItem>
                    <SelectItem value="Work From Home">Work From Home</SelectItem>
                    <SelectItem value="Client Site">Client Site</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Work Type</label>
                <Select 
                  value={editFormData.workType} 
                  onValueChange={(value) => setEditFormData({ ...editFormData, workType: value })}
                >
                  <SelectTrigger style={{ width: '100%', padding: '12px' }}>
                    <SelectValue placeholder="Select work type" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="Regular">Regular</SelectItem>
                    <SelectItem value="Overtime">Overtime</SelectItem>
                    <SelectItem value="Holiday">Holiday</SelectItem>
                    <SelectItem value="Weekend">Weekend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingEntry(null);
                  }} 
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#ffffff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Update Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Time Entries"
        description={`Are you sure you want to delete ${selectedEntries.length} time ${selectedEntries.length === 1 ? 'entry' : 'entries'}? This action cannot be undone.`}
        onConfirm={handleDeleteSelected}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
};

export default TimeHistory;
