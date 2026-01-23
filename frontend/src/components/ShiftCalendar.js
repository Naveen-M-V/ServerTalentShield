import React, { useState, useEffect } from 'react';
import moment from 'moment-timezone';
import { getUserTimeEntries } from '../utils/clockApi';

/**
 * Shift Calendar Component
 * Calendar view for employees to see their shifts and time entries
 */

const ShiftCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonthEntries();
  }, [currentDate]);

  const fetchMonthEntries = async () => {
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const response = await getUserTimeEntries(
        startOfMonth.toISOString().split('T')[0],
        endOfMonth.toISOString().split('T')[0]
      );
      
      if (response.success) {
        setTimeEntries(response.data);
      }
    } catch (error) {
      console.error('Fetch month entries error:', error);
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
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const getEntryForDate = (day) => {
    if (!day) return null;
    
    // Use UK timezone for date comparison
    const dateStr = moment.tz([currentDate.getFullYear(), currentDate.getMonth(), day], 'Europe/London').format('YYYY-MM-DD');
    
    return timeEntries.find(entry => {
      const entryDate = moment.utc(entry.date).tz('Europe/London').format('YYYY-MM-DD');
      return entryDate === dateStr;
    });
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    // If it's already in HH:mm format, return as is
    if (typeof timeString === 'string' && /^\d{2}:\d{2}$/.test(timeString)) {
      return timeString;
    }
    // If it's an ISO date string, convert to UK time
    return moment.utc(timeString).tz('Europe/London').format('HH:mm');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'clocked_in': return '#10b981';
      case 'clocked_out': return '#3b82f6';
      case 'on_break': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #10b981',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#6b7280' }}>Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      {/* Calendar Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <button
          onClick={() => navigateMonth(-1)}
          style={{
            padding: '8px 16px',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ← Previous
        </button>
        
        <h2 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#111827'
        }}>
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        
        <button
          onClick={() => navigateMonth(1)}
          style={{
            padding: '8px 16px',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Next →
        </button>
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        background: '#e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        {/* Day Headers */}
        {dayNames.map(day => (
          <div key={day} style={{
            background: '#f9fafb',
            padding: '12px 8px',
            textAlign: 'center',
            fontSize: '12px',
            fontWeight: '600',
            color: '#6b7280'
          }}>
            {day}
          </div>
        ))}
        
        {/* Calendar Days */}
        {getDaysInMonth().map((day, index) => {
          const entry = getEntryForDate(day);
          const isToday = day && 
            new Date().toDateString() === 
            new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
          
          return (
            <div key={index} style={{
              background: '#ffffff',
              minHeight: '80px',
              padding: '8px',
              position: 'relative',
              border: isToday ? '2px solid #10b981' : 'none'
            }}>
              {day && (
                <>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: isToday ? '600' : '400',
                    color: isToday ? '#10b981' : '#111827',
                    marginBottom: '4px'
                  }}>
                    {day}
                  </div>
                  
                  {entry && (
                    <div style={{
                      fontSize: '10px',
                      color: '#6b7280'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '2px'
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: getStatusColor(entry.status),
                          marginRight: '4px'
                        }}></div>
                        <span>{formatTime(entry.clockIn)}</span>
                      </div>
                      
                      {entry.clockOut && (
                        <div style={{
                          paddingLeft: '10px',
                          color: '#9ca3af'
                        }}>
                          to {formatTime(entry.clockOut)}
                        </div>
                      )}
                      
                      <div style={{
                        paddingLeft: '10px',
                        fontSize: '9px',
                        color: '#9ca3af',
                        marginTop: '2px'
                      }}>
                        {entry.workType || 'Regular'}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '16px',
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#10b981'
          }}></div>
          <span>Clocked In</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#3b82f6'
          }}></div>
          <span>Clocked Out</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#f59e0b'
          }}></div>
          <span>On Break</span>
        </div>
      </div>
    </div>
  );
};

export default ShiftCalendar;
