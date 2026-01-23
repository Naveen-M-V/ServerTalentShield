import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PrinterIcon,
  EnvelopeIcon, 
  PhoneIcon, 
  MapPinIcon,
  BriefcaseIcon,
  CalendarIcon,
  ClockIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  UserCircleIcon,
  UserMinusIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import { buildApiUrl } from '../utils/apiConfig';
import { formatDateDDMMYY, getDayName } from '../utils/dateFormatter';
import TerminationFlowModal from './TerminationFlowModal';
import { useAuth } from '../context/AuthContext';

const EmployeeProfileModal = ({ employee, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [certificates, setCertificates] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showTerminationModal, setShowTerminationModal] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (employee) {
      fetchEmployeeDetails();
    }
  }, [employee]);

  const fetchEmployeeDetails = async () => {
    setLoading(true);
    try {
      const employeeId = employee._id || employee.id;
      console.log('Fetching details for employee:', employeeId);

      // Fetch certificates
      try {
        const certResponse = await fetch(buildApiUrl(`/api/certificates/profile/${employeeId}`), {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        if (certResponse.ok) {
          const certData = await certResponse.json();
          console.log('Certificates data:', certData);
          setCertificates(Array.isArray(certData) ? certData : []);
        } else {
          console.error('Failed to fetch certificates:', certResponse.status);
        }
      } catch (err) {
        console.error('Error fetching certificates:', err);
      }

      // Fetch recent time entries
      try {
        const timeResponse = await fetch(buildApiUrl(`/api/clock/history/${employeeId}?limit=10`), {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        if (timeResponse.ok) {
          const timeData = await timeResponse.json();
          console.log('Time entries data:', timeData);
          setTimeEntries(timeData.entries || timeData || []);
        } else {
          console.error('Failed to fetch time entries:', timeResponse.status);
        }
      } catch (err) {
        console.error('Error fetching time entries:', err);
      }
    } catch (error) {
      console.error('Error fetching employee details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  const getCertificateStatus = (cert) => {
    if (!cert.expiryDate) return { status: 'valid', color: '#10b981', label: 'Valid' };
    const daysUntilExpiry = Math.ceil((new Date(cert.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) return { status: 'expired', color: '#ef4444', label: 'Expired' };
    if (daysUntilExpiry <= 30) return { status: 'expiring', color: '#f59e0b', label: `${daysUntilExpiry}d left` };
    return { status: 'valid', color: '#10b981', label: 'Valid' };
  };

  // Check if current user has Admin role
  const canTerminateEmployee = () => {
    if (!user) return false;
    const userRole = user.role?.toLowerCase();
    return userRole === 'admin' || userRole === 'super-admin';
  };

  // Handle successful termination
  const handleTerminationSuccess = (terminatedEmployee) => {
    // Update the employee data to reflect termination
    if (employee) {
      employee.status = 'Terminated';
      employee.isActive = false;
      employee.terminatedDate = terminatedEmployee.terminatedDate;
    }
    // Show success message (you could use a toast notification here)
    alert('Employee terminated successfully');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(4px)',
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        maxWidth: '1000px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out'
      }}>
        {/* Header Section */}
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          padding: '32px',
          position: 'relative',
          color: 'white'
        }}>
          <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '10px', zIndex: 1000 }}>
            {/* Termination Button */}
            {user && (user.role === 'admin' || user.role === 'super-admin') && employee && employee.status !== 'Terminated' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTerminationModal(true);
                }}
                style={{
                  background: 'rgba(220, 38, 38, 0.9)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(185, 28, 28, 0.9)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(220, 38, 38, 0.9)'}
                title="Terminate Employee"
              >
                <UserMinusIcon style={{ width: '20px', height: '20px', color: 'white' }} />
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              <XMarkIcon style={{ width: '24px', height: '24px', color: 'white' }} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Profile Picture */}
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              fontWeight: '700',
              color: 'white',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              border: '4px solid rgba(255, 255, 255, 0.3)'
            }}>
              {employee.firstName?.[0]}{employee.lastName?.[0]}
            </div>

            {/* Employee Info */}
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontSize: '28px',
                fontWeight: '700',
                marginBottom: '8px',
                color: 'white'
              }}>
                {employee.firstName} {employee.lastName}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <BriefcaseIcon style={{ width: '18px', height: '18px', color: 'rgba(255, 255, 255, 0.9)' }} />
                <span style={{ fontSize: '16px', color: 'rgba(255, 255, 255, 0.9)' }}>
                  {employee.jobTitle || employee.jobRole || 'Employee'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '500',
                  backdropFilter: 'blur(10px)'
                }}>
                  VTID: {employee.vtid || 'N/A'}
                </div>
                <div style={{
                  background: employee.status === 'clocked_in' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '500',
                  backdropFilter: 'blur(10px)'
                }}>
                  {employee.status === 'clocked_in' ? '🟢 Clocked In' : 
                   employee.status === 'on_break' ? '🟡 On Break' : 
                   employee.status === 'clocked_out' ? '🔵 Clocked Out' : '⚪ Absent'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #f3f4f6',
          background: '#fafafa',
          padding: '0 32px'
        }}>
          {['overview', 'certificates', 'attendance'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '16px 24px',
                border: 'none',
                background: 'transparent',
                fontSize: '15px',
                fontWeight: '600',
                color: activeTab === tab ? '#10b981' : '#6b7280',
                cursor: 'pointer',
                borderBottom: activeTab === tab ? '3px solid #10b981' : '3px solid transparent',
                transition: 'all 0.2s',
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px'
        }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              {/* Contact Information */}
              <div style={{
                background: '#f9fafb',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #e5e7eb'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#111827',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <UserCircleIcon style={{ width: '24px', height: '24px', color: '#10b981' }} />
                  Contact Information
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: '#e0f2fe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <EnvelopeIcon style={{ width: '20px', height: '20px', color: '#0284c7' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>Email</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {employee.email || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: '#ddd6fe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <PhoneIcon style={{ width: '20px', height: '20px', color: '#7c3aed' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>Phone</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {employee.phoneNumber || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: '#fce7f3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <MapPinIcon style={{ width: '20px', height: '20px', color: '#db2777' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>Address</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {[
                          employee.address1 || employee.addressLine1 || employee.address,
                          employee.address2 || employee.addressLine2,
                          employee.address3 || employee.addressLine3,
                          employee.townCity || employee.city,
                          employee.county,
                          employee.postcode || employee.postalCode
                        ].filter(Boolean).join(', ') || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div style={{
                background: '#f9fafb',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #e5e7eb'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#111827',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <BriefcaseIcon style={{ width: '24px', height: '24px', color: '#6366F1' }} />
                  Employment Details
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Job Role</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                      {Array.isArray(employee.jobRole) ? employee.jobRole.join(', ') : employee.jobRole || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Department</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                      {employee.department || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Start Date</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                      {employee.startDate ? formatDateDDMMYY(employee.startDate) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Employment Type</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                      {employee.employmentType || 'Full-time'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                borderRadius: '16px',
                padding: '24px',
                color: 'white',
                gridColumn: 'span 1'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <DocumentTextIcon style={{ width: '24px', height: '24px' }} />
                  Quick Stats
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Certificates</div>
                    <div style={{ fontSize: '28px', fontWeight: '700' }}>{certificates.length}</div>
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Clock-ins</div>
                    <div style={{ fontSize: '28px', fontWeight: '700' }}>{timeEntries.length}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'certificates' && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                  Certificates ({certificates.length})
                </h3>
              </div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  Loading certificates...
                </div>
              ) : certificates.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  background: '#f9fafb',
                  borderRadius: '16px',
                  border: '2px dashed #e5e7eb'
                }}>
                  <AcademicCapIcon style={{ width: '64px', height: '64px', color: '#d1d5db', margin: '0 auto 16px' }} />
                  <p style={{ fontSize: '16px', color: '#6b7280' }}>No certificates found</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {certificates.map((cert, idx) => {
                    const status = getCertificateStatus(cert);
                    return (
                      <div key={idx} style={{
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '16px',
                        padding: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}>
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '12px',
                          background: status.status === 'expired' ? '#fee2e2' : 
                                     status.status === 'expiring' ? '#fef3c7' : '#d1fae5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {status.status === 'expired' ? (
                            <ExclamationCircleIcon style={{ width: '28px', height: '28px', color: '#ef4444' }} />
                          ) : (
                            <CheckCircleIcon style={{ width: '28px', height: '28px', color: status.color }} />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                            {cert.certificate || cert.certificateName}
                          </h4>
                          <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6b7280' }}>
                            <span>Category: {cert.category || 'General'}</span>
                            {cert.expiryDate && (
                              <span>Expires: {formatDateDDMMYY(cert.expiryDate)}</span>
                            )}
                          </div>
                        </div>
                        <div style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: status.color,
                          background: `${status.color}15`
                        }}>
                          {status.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                  Recent Clock-ins
                </h3>
              </div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  Loading attendance...
                </div>
              ) : timeEntries.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  background: '#f9fafb',
                  borderRadius: '16px',
                  border: '2px dashed #e5e7eb'
                }}>
                  <ClockIcon style={{ width: '64px', height: '64px', color: '#d1d5db', margin: '0 auto 16px' }} />
                  <p style={{ fontSize: '16px', color: '#6b7280' }}>No attendance records found</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {timeEntries.map((entry, idx) => (
                    <div key={idx} style={{
                      background: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '16px',
                      padding: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '20px',
                        fontWeight: '700'
                      }}>
                        <ClockIcon style={{ width: '28px', height: '28px' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                          {getDayName(entry.date)}, {formatDateDDMMYY(entry.date)}
                        </h4>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6b7280' }}>
                          <span>In: {entry.clockIn ? new Date(entry.clockIn).toLocaleTimeString() : 'N/A'}</span>
                          <span>Out: {entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString() : 'Active'}</span>
                          <span>Location: {entry.location || 'N/A'}</span>
                        </div>
                      </div>
                      <div style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#6366F1',
                        background: '#eef2ff'
                      }}>
                        {entry.workType || 'Regular'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Termination Flow Modal */}
      <TerminationFlowModal
        employee={employee}
        isOpen={showTerminationModal}
        onClose={() => setShowTerminationModal(false)}
        onSuccess={handleTerminationSuccess}
      />

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default EmployeeProfileModal;
