import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { DatePicker } from './ui/date-picker';
import axios from '../utils/axiosConfig';
import {
  CalendarIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PaperAirplaneIcon,
  SaveIcon
} from '@heroicons/react/24/outline';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const LeaveRequestForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    approverId: '',
    leaveType: 'Casual',
    startDate: null,
    endDate: null,
    reason: ''
  });

  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [numberOfDays, setNumberOfDays] = useState(0);

  const leaveTypes = ['Sick', 'Casual', 'Paid', 'Unpaid', 'Maternity', 'Paternity', 'Bereavement', 'Other'];

  useEffect(() => {
    fetchManagers();
  }, []);

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setNumberOfDays(diffDays);
    }
  }, [formData.startDate, formData.endDate]);

  const fetchManagers = async () => {
    try {
      console.log('📋 Fetching approvers (admin/super-admin only)...');
      
      const response = await axios.get('/api/users');
      console.log('📊 API response:', response.data);

      if (response.data.success && response.data.data) {
        console.log('✅ Found', response.data.data.length, 'admin/super-admin accounts');
        console.log('📋 Data:', response.data.data);
        setManagers(response.data.data);
      } else {
        console.warn('⚠️ No approvers found in response');
        setManagers([]);
      }
    } catch (error) {
      console.error('❌ Error fetching approvers:', error);
      toast.error('Failed to load approvers');
      setManagers([]);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.approverId) newErrors.approverId = 'Please select an approver';
    if (!formData.leaveType) newErrors.leaveType = 'Please select a leave type';
    if (!formData.startDate) newErrors.startDate = 'Please select a start date';
    if (!formData.endDate) newErrors.endDate = 'Please select an end date';
    if (!formData.reason || formData.reason.trim().length < 10) {
      newErrors.reason = 'Reason must be at least 10 characters';
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (start > end) {
        newErrors.dateRange = 'Start date must be before end date';
      }
      if (start < new Date()) {
        newErrors.dateRange = 'Cannot request leave for past dates';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);
    try {
      // Get current user from localStorage or auth context
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      const payload = {
        employeeId: currentUser._id || currentUser.id, // Logged-in employee
        approverId: formData.approverId,
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason,
        status: isDraft ? 'draft' : 'pending'
      };

      const response = await axios.post('/api/leave-requests', payload);

      if (response.data.success) {
        toast.success('Leave request sent successfully!', {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          style: {
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '16px',
            borderRadius: '12px',
            padding: '16px 24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
          }
        });
        setFormData({
          approverId: '',
          leaveType: 'Casual',
          startDate: null,
          endDate: null,
          reason: ''
        });
        setErrors({});
        if (onSuccess) onSuccess(response.data.data);
      } else {
        toast.error(response.data.message || 'Failed to submit leave request');
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      const errorMsg = error.response?.data?.message || 'Failed to submit leave request';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '16px',
      padding: '32px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb'
    }}>
      <h2 style={{
        fontSize: '22px',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <PaperAirplaneIcon style={{ width: '24px', height: '24px', color: '#3b82f6' }} />
        Request Leave
      </h2>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Approval Manager */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Approval Manager *
            </label>
            <Select
              value={formData.approverId}
              onValueChange={(value) => setFormData({ ...formData, approverId: value })}
            >
              <SelectTrigger className={`w-full ${errors.approverId ? "border-red-500 ring-red-500" : ""}`}>
                <SelectValue placeholder="Select a manager" />
              </SelectTrigger>
              <SelectContent>
                {managers.map(manager => {
                  const roleDisplay = manager.role === 'super-admin' ? 'Super Admin' :
                                    manager.role.charAt(0).toUpperCase() + manager.role.slice(1);
                  return (
                    <SelectItem key={manager._id} value={manager._id}>
                      {manager.firstName} {manager.lastName} — {roleDisplay}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.approverId && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.approverId}</p>
            )}
          </div>

          {/* Leave Type */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Leave Type *
            </label>
            <Select
              value={formData.leaveType}
              onValueChange={(value) => setFormData({ ...formData, leaveType: value })}
            >
              <SelectTrigger className={`w-full ${errors.leaveType ? "border-red-500 ring-red-500" : ""}`}>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.leaveType && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.leaveType}</p>
            )}
          </div>

          {/* Start Date */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Start Date *
            </label>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <CalendarIcon style={{
                position: 'absolute',
                left: '12px',
                width: '18px',
                height: '18px',
                color: '#9ca3af',
                pointerEvents: 'none'
              }} />
              <input
                type="date"
                value={formData.startDate ? formData.startDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value ? new Date(e.target.value) : null })}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 40px',
                  border: errors.startDate ? '2px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  background: '#ffffff',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => !errors.startDate && (e.target.style.borderColor = '#3b82f6')}
                onBlur={(e) => !errors.startDate && (e.target.style.borderColor = '#d1d5db')}
              />
            </div>
            {errors.startDate && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.startDate}</p>
            )}
          </div>

          {/* End Date */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              End Date *
            </label>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <CalendarIcon style={{
                position: 'absolute',
                left: '12px',
                width: '18px',
                height: '18px',
                color: '#9ca3af',
                pointerEvents: 'none'
              }} />
              <input
                type="date"
                value={formData.endDate ? formData.endDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value ? new Date(e.target.value) : null })}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 40px',
                  border: errors.endDate ? '2px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  background: '#ffffff',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => !errors.endDate && (e.target.style.borderColor = '#3b82f6')}
                onBlur={(e) => !errors.endDate && (e.target.style.borderColor = '#d1d5db')}
              />
            </div>
            {errors.endDate && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{errors.endDate}</p>
            )}
          </div>
        </div>

        {/* Date Range Error */}
        {errors.dateRange && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#991b1b'
          }}>
            <ExclamationCircleIcon style={{ width: '18px', height: '18px' }} />
            {errors.dateRange}
          </div>
        )}

        {/* Number of Days Display */}
        {numberOfDays > 0 && (
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#1e40af'
          }}>
            <CheckCircleIcon style={{ width: '18px', height: '18px' }} />
            <span><strong>{numberOfDays}</strong> day(s) of leave requested</span>
          </div>
        )}

        {/* Reason */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px'
          }}>
            Reason for Leave *
          </label>
          <textarea
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Please provide a detailed reason for your leave request (minimum 10 characters)"
            style={{
              width: '100%',
              padding: '12px 16px',
              border: errors.reason ? '2px solid #ef4444' : '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              minHeight: '120px',
              resize: 'vertical',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => !errors.reason && (e.target.style.borderColor = '#3b82f6')}
            onBlur={(e) => !errors.reason && (e.target.style.borderColor = '#d1d5db')}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px'
          }}>
            <p style={{ color: '#6b7280', fontSize: '12px' }}>
              {formData.reason.length} / 500 characters
            </p>
            {errors.reason && (
              <p style={{ color: '#ef4444', fontSize: '12px' }}>{errors.reason}</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={loading}
            style={{
              padding: '12px 24px',
              border: '1px solid #d1d5db',
              background: '#ffffff',
              color: '#6b7280',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => !loading && (e.target.style.background = '#f9fafb')}
            onMouseLeave={(e) => !loading && (e.target.style.background = '#ffffff')}
          >
            <SaveIcon style={{ width: '16px', height: '16px' }} />
            Save as Draft
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: loading ? '#9ca3af' : '#3b82f6',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
            }}
            onMouseEnter={(e) => !loading && (e.target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)')}
            onMouseLeave={(e) => !loading && (e.target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)')}
          >
            <PaperAirplaneIcon style={{ width: '16px', height: '16px' }} />
            {loading ? 'Submitting...' : 'Send Request'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LeaveRequestForm;
