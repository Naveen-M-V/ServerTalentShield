import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import { SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const LeaveBalanceCards = () => {
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaveBalance();
  }, []);

  const fetchLeaveBalance = async () => {
    try {
      const response = await axios.get('/api/leave/balance');
      if (response.data.success && response.data.data) {
        setLeaveBalance(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {[1, 2].map(i => (
          <div key={i} style={{
            background: '#f9fafb',
            borderRadius: '12px',
            padding: '20px',
            height: '150px',
            animation: 'pulse 2s infinite'
          }} />
        ))}
      </div>
    );
  }

  if (!leaveBalance) {
    return null;
  }

  const daysRemaining = leaveBalance.totalDays - (leaveBalance.daysUsed || 0);
  const usagePercentage = ((leaveBalance.daysUsed || 0) / leaveBalance.totalDays) * 100;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '20px',
      marginBottom: '32px'
    }}>
      {/* Leaves Remaining Card */}
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        borderRadius: '16px',
        padding: '24px',
        color: '#ffffff',
        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
        border: '1px solid rgba(16, 185, 129, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: '600',
            opacity: 0.9,
            margin: 0
          }}>
            Leaves Remaining
          </h3>
          <CheckCircleIcon style={{ width: '24px', height: '24px', opacity: 0.8 }} />
        </div>
        <div style={{
          fontSize: '32px',
          fontWeight: '700',
          marginBottom: '8px'
        }}>
          {daysRemaining}
        </div>
        <p style={{
          fontSize: '13px',
          opacity: 0.9,
          margin: 0
        }}>
          out of {leaveBalance.totalDays} days
        </p>
      </div>

      {/* Leaves Used Card */}
      <div style={{
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        borderRadius: '16px',
        padding: '24px',
        color: '#ffffff',
        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
        border: '1px solid rgba(245, 158, 11, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: '600',
            opacity: 0.9,
            margin: 0
          }}>
            Leaves Used
          </h3>
          <SparklesIcon style={{ width: '24px', height: '24px', opacity: 0.8 }} />
        </div>
        <div style={{
          fontSize: '32px',
          fontWeight: '700',
          marginBottom: '8px'
        }}>
          {leaveBalance.daysUsed || 0}
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          height: '6px',
          marginTop: '12px',
          overflow: 'hidden'
        }}>
          <div style={{
            background: '#ffffff',
            height: '100%',
            width: `${usagePercentage}%`,
            transition: 'width 0.3s ease'
          }} />
        </div>
        <p style={{
          fontSize: '12px',
          opacity: 0.9,
          margin: '8px 0 0 0'
        }}>
          {usagePercentage.toFixed(0)}% used
        </p>
      </div>
    </div>
  );
};

export default LeaveBalanceCards;
