import React, { useMemo } from 'react';

/**
 * ShiftTimeline Component
 * Displays employee shift schedules using custom timeline grid
 * Beautiful visual representation of employee shifts
 */

const ShiftTimeline = ({ rotaData, view = 'week', onEventClick }) => {
  
  /**
   * Get unique dates from rota data
   */
  const dates = useMemo(() => {
    if (!rotaData || rotaData.length === 0) return [];
    
    const uniqueDates = [...new Set(rotaData.map(r => new Date(r.date).toDateString()))];
    return uniqueDates.sort((a, b) => new Date(a) - new Date(b));
  }, [rotaData]);

  /**
   * Get unique employees
   */
  const employees = useMemo(() => {
    if (!rotaData || rotaData.length === 0) return [];
    
    const uniqueEmployees = {};
    rotaData.forEach(rota => {
      if (!uniqueEmployees[rota.employee._id]) {
        uniqueEmployees[rota.employee._id] = {
          id: rota.employee._id,
          name: rota.employee.name,
          department: rota.employee.department
        };
      }
    });
    
    return Object.values(uniqueEmployees);
  }, [rotaData]);

  /**
   * Get shift for specific employee and date
   */
  const getShiftForEmployeeAndDate = (employeeId, dateStr) => {
    return rotaData.find(r => 
      r.employee._id === employeeId && 
      new Date(r.date).toDateString() === dateStr
    );
  };

  /**
   * Format date for display
   */
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]}\n${date.getDate()}/${date.getMonth() + 1}`;
  };

  /**
   * Handle shift click
   */
  const handleShiftClick = (shift) => {
    if (onEventClick && shift) {
      onEventClick({
        id: shift._id,
        title: shift.shift.name,
        employeeName: shift.employee.name,
        department: shift.employee.department,
        shiftTime: `${shift.shift.startTime} - ${shift.shift.endTime}`,
        status: shift.status
      });
    }
  };

  if (!rotaData || rotaData.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: '#6b7280',
        fontSize: '16px',
        background: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <svg 
          style={{ width: '64px', height: '64px', margin: '0 auto 16px', opacity: 0.5 }}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
          />
        </svg>
        <p>No shift schedules found. Generate a rota to get started.</p>
      </div>
    );
  }

  return (
    <div style={{ 
      background: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'auto',
      maxHeight: '600px'
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        minWidth: '800px'
      }}>
        <thead style={{
          position: 'sticky',
          top: 0,
          background: '#f9fafb',
          zIndex: 10
        }}>
          <tr>
            <th style={{
              padding: '16px',
              textAlign: 'left',
              borderBottom: '2px solid #e5e7eb',
              borderRight: '1px solid #e5e7eb',
              fontWeight: '600',
              color: '#111827',
              minWidth: '200px',
              position: 'sticky',
              left: 0,
              background: '#f9fafb',
              zIndex: 11
            }}>
              Employee
            </th>
            {dates.map((dateStr, idx) => (
              <th key={idx} style={{
                padding: '16px 12px',
                textAlign: 'center',
                borderBottom: '2px solid #e5e7eb',
                fontWeight: '600',
                color: '#111827',
                minWidth: '120px',
                whiteSpace: 'pre-line',
                lineHeight: '1.4'
              }}>
                {formatDate(dateStr)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee, empIdx) => (
            <tr key={employee.id} style={{
              background: empIdx % 2 === 0 ? '#ffffff' : '#f9fafb'
            }}>
              <td style={{
                padding: '16px',
                borderBottom: '1px solid #e5e7eb',
                borderRight: '1px solid #e5e7eb',
                position: 'sticky',
                left: 0,
                background: empIdx % 2 === 0 ? '#ffffff' : '#f9fafb',
                zIndex: 9
              }}>
                <div>
                  <div style={{
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '4px'
                  }}>
                    {employee.name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    {employee.department}
                  </div>
                </div>
              </td>
              {dates.map((dateStr, dateIdx) => {
                const shift = getShiftForEmployeeAndDate(employee.id, dateStr);
                return (
                  <td key={dateIdx} style={{
                    padding: '8px',
                    borderBottom: '1px solid #e5e7eb',
                    textAlign: 'center'
                  }}>
                    {shift ? (
                      <div
                        onClick={() => handleShiftClick(shift)}
                        style={{
                          background: shift.shift.color || '#3b82f6',
                          color: '#ffffff',
                          padding: '12px 8px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                        }}
                      >
                        <div style={{ marginBottom: '4px' }}>
                          {shift.shift.name}
                        </div>
                        <div style={{ 
                          fontSize: '11px', 
                          opacity: 0.9,
                          whiteSpace: 'nowrap'
                        }}>
                          {shift.shift.startTime}-{shift.shift.endTime}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        padding: '12px 8px',
                        color: '#d1d5db',
                        fontSize: '12px'
                      }}>
                        -
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #e5e7eb',
        background: '#f9fafb',
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '16px',
            height: '16px',
            background: '#3b82f6',
            borderRadius: '4px'
          }}></div>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>Morning</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '16px',
            height: '16px',
            background: '#f59e0b',
            borderRadius: '4px'
          }}></div>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>Evening</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '16px',
            height: '16px',
            background: '#8b5cf6',
            borderRadius: '4px'
          }}></div>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>Night</span>
        </div>
      </div>
    </div>
  );
};

export default ShiftTimeline;
