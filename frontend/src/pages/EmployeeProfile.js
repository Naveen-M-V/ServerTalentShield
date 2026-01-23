import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDateDDMMYY } from '../utils/dateFormatter';
import { 
  User, 
  Mail, 
  MapPin, 
  Calendar,
  Clock,
  Plus,
  Filter,
  ChevronDown,
  Briefcase,
  FileText,
  UserGroup,
  AlertCircle,
  FolderOpen,
  Upload,
  Phone,
  CreditCard,
  Shield,
  Home,
  Users,
  Download,
  UserMinus,
  Trash2,
  X
} from 'lucide-react';
import axios from '../utils/axiosConfig';
import AddLeaveModal from '../components/AddLeaveModal';
import AddTimeOffModal from '../components/AddTimeOffModal';
import { SicknessModal, LatenessModal, CarryoverModal } from '../components/AbsenceModals';
import TerminationFlowModal from '../components/TerminationFlowModal';
import { useAuth } from '../context/AuthContext';
import { buildApiUrl, buildDirectUrl } from '../utils/apiConfig';

const EmployeeProfile = () => {
  const [showLeaveModal, setShowLeaveModal] = React.useState(false);
  const [showTimeOffModal, setShowTimeOffModal] = React.useState(false);
  const [showSicknessModal, setShowSicknessModal] = React.useState(false);
  const [showLatenessModal, setShowLatenessModal] = React.useState(false);
  const [showCarryoverModal, setShowCarryoverModal] = React.useState(false);
  const [showTerminationModal, setShowTerminationModal] = React.useState(false);
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');

  // Function to refresh employee data after leave is added
  const refreshAbsences = () => {
    fetchEmployeeData();
  };

  const tabs = [
    { id: 'personal', label: 'Personal' },
    { id: 'employment', label: 'Employment' },
    { id: 'emergencies', label: 'Emergencies' },
    { id: 'documents', label: 'Documents' },
    { id: 'absence', label: 'Absence' },
    { id: 'overtime', label: 'Overtime' }
  ];

  useEffect(() => {
    fetchEmployeeData();
  }, [employeeId]);

  const fetchEmployeeData = async () => {
    try {
      // Validate MongoDB ObjectId format (24 hex characters)
      const objectIdPattern = /^[0-9a-fA-F]{24}$/;
      if (!objectIdPattern.test(employeeId)) {
        console.error('Invalid employee ID format:', employeeId);
        setLoading(false);
        return;
      }

      setLoading(true);
      const response = await axios.get(buildApiUrl(`/employee-profile/${employeeId}`));
      
      // STEP 1: LOG FULL API RESPONSE
      console.log("═══════════════════════════════════════");
      console.log("PROFILE API PAYLOAD:", response.data);
      console.log("═══════════════════════════════════════");
      console.log("Address Fields:", {
        address1: response.data?.address1,
        address2: response.data?.address2,
        address3: response.data?.address3,
        addressLine1: response.data?.addressLine1,
        addressLine2: response.data?.addressLine2,
        addressLine3: response.data?.addressLine3,
        city: response.data?.city,
        townCity: response.data?.townCity,
        county: response.data?.county,
        postcode: response.data?.postcode
      });
      console.log("Emergency Contact:", {
        name: response.data?.emergencyContactName,
        relation: response.data?.emergencyContactRelation,
        phone: response.data?.emergencyContactPhone,
        email: response.data?.emergencyContactEmail
      });
      console.log("Documents:", response.data?.folders);
      console.log("═══════════════════════════════════════");
      
      // The employee-profile endpoint returns data directly, not wrapped in success/data
      if (response.data) {
        setEmployee(response.data);
      } else {
        console.error('Employee not found or API returned unsuccessful response');
        setEmployee(null);
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
      if (error.response?.status === 404) {
        console.error('Employee not found (404)');
      } else if (error.response?.status === 400) {
        console.error('Invalid request (400)');
      }
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'NA';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const sendRegistrationEmail = async () => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/employees/${employeeId}/send-registration`);
      if (response.data.success) {
        alert('Registration email sent successfully!');
      } else {
        alert('Failed to send registration email');
      }
    } catch (error) {
      console.error('Error sending registration email:', error);
      alert('Failed to send registration email');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Employee not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      {/* Employee Header - Pixel-accurate, screenshot-matched */}
<div className="bg-white border border-[#0056b3] rounded-lg p-6 mb-8">
  <div className="flex items-center gap-8">
    {/* Avatar */}
    <div className="relative">
      <div className="w-[160px] h-[160px] rounded-full bg-[#0056b3] flex items-center justify-center ring-4 ring-[#e6f0fa] overflow-hidden">
  {employee.profilePhoto ? (
    <img
      src={employee.profilePhoto}
      alt={employee.name || 'Employee'}
      className="w-full h-full object-cover rounded-full"
    />
  ) : (
    <span className="text-4xl font-bold text-white select-none">
      {employee.initials || (employee.name ? employee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '')}
    </span>
  )}
</div>
      {/* Edit Icon */}
      <button
        className="absolute bottom-4 right-4 bg-white p-2 rounded-full shadow-md border border-gray-200 hover:bg-blue-50 transition-colors"
        title="Edit photo"
        tabIndex={0}
      >
        <svg className="w-5 h-5 text-[#e00070]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6-6 3 3-6 6H9v-3z" />
        </svg>
      </button>
    </div>
    {/* Details */}
    <div className="flex-1 flex flex-col gap-1 text-left">
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold text-gray-900 leading-tight">
          {employee.name || employee.firstName && employee.lastName ? `${employee.firstName} ${employee.lastName}` : ''}
        </span>
        <button
          onClick={() => navigate(`/edit-employee/${employeeId}`)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          title="Edit Employee Details"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6-6 3 3-6 6H9v-3z" />
          </svg>
          Edit Profile
        </button>
        {/* Terminate Button - only visible to Admin */}
        {user && (user.role === 'admin' || user.role === 'super-admin') && employee && employee.status !== 'Terminated' && (
          <button
            onClick={() => setShowTerminationModal(true)}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            title="Terminate Employee"
          >
            <UserMinus className="w-4 h-4" />
            Terminate
          </button>
        )}
      </div>
<span className="text-base text-gray-700">
  {employee.jobRole || employee.jobTitle || employee.position || ''}
</span>
<span className="flex items-center text-base text-gray-600 mt-1">
  <svg className="w-4 h-4 mr-2 text-[#0056b3]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 21a2 2 0 01-2.828 0l-4.243-4.343a8 8 0 1111.314 0z" /><circle cx="12" cy="11" r="3" /></svg>
  {employee.officeLocation || employee.workLocation || employee.OrganisationName || employee.office || ''}
</span>
<span className="flex items-center text-base text-gray-600 mt-1">
  <Mail className="w-4 h-4 mr-2 text-[#0056b3]" />
  {employee.email || employee.emailAddress || ''}
</span>
<span className="flex items-center text-base text-gray-600 mt-1">
  <Phone className="w-4 h-4 mr-2 text-[#0056b3]" />
  {employee.phoneNumber || employee.mobileNumber || employee.phone || employee.workPhone || ''}
</span>
    </div>
  </div>
</div>

      {/* Employee Identity Section */}
      {/* Avatar and info now in header above, so this section is removed */}

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'personal' && <PersonalTab employee={employee} />}
        {activeTab === 'employment' && <EmploymentTab employee={employee} />}
        {activeTab === 'emergencies' && <EmergenciesTab employee={employee} />}
        {activeTab === 'documents' && <DocumentsTab employee={employee} />}
        {activeTab === 'absence' && (
  <AbsenceTab 
    employee={employee} 
    onAddLeave={() => setShowLeaveModal(true)}
    onAddTimeOff={() => setShowTimeOffModal(true)}
    onOpenCarryover={() => setShowCarryoverModal(true)}
    onOpenSickness={() => setShowSicknessModal(true)}
    onOpenLateness={() => setShowLatenessModal(true)}
  />
)}
{showLeaveModal && (
  <AddLeaveModal
    employee={employee}
    onClose={() => {
      setShowLeaveModal(false);
      refreshAbsences();
    }}
    onSuccess={() => {
      setShowLeaveModal(false);
      refreshAbsences();
    }}
  />
)}
{showTimeOffModal && (
  <AddTimeOffModal
    employee={employee}
    onClose={() => {
      setShowTimeOffModal(false);
      refreshAbsences();
    }}
    onSuccess={() => {
      setShowTimeOffModal(false);
      refreshAbsences();
    }}
  />
)}
{showSicknessModal && (
  <SicknessModal
    employee={employee}
    onClose={() => setShowSicknessModal(false)}
    onSuccess={() => refreshAbsences()}
  />
)}
{showLatenessModal && (
  <LatenessModal
    employee={employee}
    onClose={() => setShowLatenessModal(false)}
    onSuccess={() => refreshAbsences()}
  />
)}
{showCarryoverModal && (
  <CarryoverModal
    employee={employee}
    onClose={() => setShowCarryoverModal(false)}
    onSuccess={() => refreshAbsences()}
  />
)}
        {activeTab === 'overtime' && <OvertimeTab employee={employee} />}
      </div>

      {/* Termination Flow Modal */}
      <TerminationFlowModal
        employee={employee}
        isOpen={showTerminationModal}
        onClose={() => setShowTerminationModal(false)}
        onSuccess={(terminatedEmployee) => {
          // Update employee status locally
          setEmployee(prev => ({
            ...prev,
            status: 'Terminated',
            isActive: false,
            terminatedDate: terminatedEmployee.terminatedDate
          }));
          alert('Employee terminated successfully');
          setShowTerminationModal(false);
        }}
      />
    </div>
  );
};

// Absence Tab Component
const AbsenceTab = ({ employee, onAddLeave, onAddTimeOff, onOpenCarryover, onOpenSickness, onOpenLateness }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Side */}
      <div className="space-y-6">
        {/* Filter Dropdown */}
        <div className="relative">
          <select className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg appearance-none bg-white">
            <option>Filter absences</option>
            <option>All absences</option>
            <option>This month</option>
            <option>This year</option>
          </select>
          <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Annual Leave Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Annual leave to take</h3>
          <div className="text-3xl font-bold text-gray-900 mb-4">
            {employee.leaveBalance?.taken || 0} / {employee.leaveBalance?.total || 12} days
          </div>
          <div className="space-y-3">
            <button
  type="button"
  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
  onClick={onAddLeave}
>
  Add annual leave
</button>
            <button
  type="button"
  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
  onClick={onAddTimeOff}
>
  Add time off
</button>
            <button 
              type="button"
              onClick={onOpenCarryover}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Update carryover
            </button>
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">All absences</h3>
        
        {/* Summary Boxes */}
        <div className="grid grid-cols-2 gap-4">
          {/* Sickness */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Sickness</h4>
              <button 
                type="button"
                onClick={onOpenSickness}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {employee.absences?.sicknessCount || 0}
            </div>
            <div className="text-sm text-gray-500">occurrences</div>
          </div>

          {/* Lateness */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Lateness</h4>
              <button 
                type="button"
                onClick={onOpenLateness}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {employee.absences?.latenessCount || 0}
            </div>
            <div className="text-sm text-gray-500">occurrences</div>
          </div>
        </div>

        {/* Absence List */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Recent Absences</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {employee.recentAbsences?.map((absence, index) => (
              <div key={index} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{absence.type}</div>
                  <div className="text-sm text-gray-500">{formatDateDDMMYY(absence.date)}</div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  absence.status === 'Approved' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {absence.status}
                </span>
              </div>
            )) || (
              <div className="p-4 text-center text-gray-500">
                No absences recorded
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EmploymentTab = ({ employee }) => {
  return (
    <div className="space-y-8">
      {/* Employment Details Section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Employment Details</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Job title</label>
              <div className="text-gray-900 font-medium">{employee.jobTitle || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <div className="text-gray-900 font-medium">{employee.department || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
              <div className="text-gray-900 font-medium">{employee.team || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Office</label>
              <div className="text-gray-900 font-medium">{employee.office || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Organisation</label>
              <div className="text-gray-900 font-medium">{employee.OrganisationName || employee.organisationName || employee.office || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Employment start date</label>
              <div className="text-gray-900 font-medium">{employee.startDate ? formatDateDDMMYY(employee.startDate) : 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Probation end date</label>
              <div className="text-gray-900 font-medium">{employee.probationEndDate ? formatDateDDMMYY(employee.probationEndDate) : 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Employment type</label>
              <div className="text-gray-900 font-medium">{employee.employmentType || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <div className="text-gray-900 font-medium">{employee.status || 'Active'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pay Details Section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Pay Details</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Salary</label>
              <div className="text-gray-900 font-medium">{employee.salary ? `£${employee.salary.toLocaleString()}` : 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rate</label>
              <div className="text-gray-900 font-medium">{employee.rate ? `£${employee.rate}/hour` : 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment frequency</label>
              <div className="text-gray-900 font-medium">{employee.paymentFrequency || employee.payrollCycle || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payroll number</label>
              <div className="text-gray-900 font-medium">{employee.payrollNumber || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bank name</label>
              <div className="text-gray-900 font-medium">{employee.bankName || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account name</label>
              <div className="text-gray-900 font-medium">{employee.accountName || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account number</label>
              <div className="text-gray-900 font-medium">{employee.accountNumber || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort code</label>
              <div className="text-gray-900 font-medium">{employee.sortCode || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bank branch</label>
              <div className="text-gray-900 font-medium">{employee.bankBranch || 'Not specified'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sensitive Details Section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900">Sensitive Details</h3>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tax code</label>
              <div className="text-gray-900 font-medium">{employee.taxCode || employee.taxcode || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">National Insurance Number</label>
              <div className="text-gray-900 font-medium">{employee.niNumber || employee.nationalInsuranceNumber || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Passport number</label>
              <div className="text-gray-900 font-medium">{employee.passportNumber || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Passport country</label>
              <div className="text-gray-900 font-medium">{employee.passportCountry || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Passport expiry date</label>
              <div className="text-gray-900 font-medium">{employee.passportExpiryDate ? formatDateDDMMYY(employee.passportExpiryDate) : 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Visa number</label>
              <div className="text-gray-900 font-medium">{employee.visaNumber || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Visa expiry date</label>
              <div className="text-gray-900 font-medium">{employee.visaExpiryDate ? formatDateDDMMYY(employee.visaExpiryDate) : 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Driving licence number</label>
              <div className="text-gray-900 font-medium">{employee.licenceNumber || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Licence country</label>
              <div className="text-gray-900 font-medium">{employee.licenceCountry || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Licence class</label>
              <div className="text-gray-900 font-medium">{employee.licenceClass || 'Not specified'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Licence expiry date</label>
              <div className="text-gray-900 font-medium">{employee.licenceExpiryDate ? formatDateDDMMYY(employee.licenceExpiryDate) : 'Not specified'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const OvertimeTab = ({ employee }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">Overtime Records</h3>
    <div className="text-center text-gray-500 py-8">
      Overtime tracking coming soon
    </div>
  </div>
);

const PersonalTab = ({ employee }) => {
  return (
    <div className="space-y-8">
      {/* Basic Details Section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Basic Details</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full name</label>
              <div className="text-gray-900 font-medium">{employee?.name || `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || 'Not provided'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
              <div className="text-gray-900 font-medium">{employee?.gender || 'Not provided'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date of birth</label>
              <div className="text-gray-900 font-medium">{employee?.dateOfBirth ? formatDateDDMMYY(employee.dateOfBirth) : 'Not provided'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mobile number</label>
              <div className="text-gray-900 font-medium">{employee?.phone || employee?.phoneNumber || employee?.mobileNumber || 'Not provided'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="text-gray-900 font-medium">{employee?.email || employee?.emailAddress || 'Not provided'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Address Details Section */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Address Details</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="col-span-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">Address line 1</label>
              <div className="text-gray-900 font-medium">{employee?.address1 || employee?.addressLine1 || employee?.address || 'Not provided'}</div>
            </div>
            <div className="col-span-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">Address line 2</label>
              <div className="text-gray-900 font-medium">{employee?.address2 || employee?.addressLine2 || 'Not provided'}</div>
            </div>
            <div className="col-span-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">Address line 3</label>
              <div className="text-gray-900 font-medium">{employee?.address3 || employee?.addressLine3 || 'Not provided'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Town/City</label>
              <div className="text-gray-900 font-medium">{employee?.townCity || employee?.city || 'Not provided'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">County</label>
              <div className="text-gray-900 font-medium">{employee?.county || 'Not provided'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Postcode</label>
              <div className="text-gray-900 font-medium">{employee?.postcode || employee?.postalCode || 'Not provided'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EmergenciesTab = ({ employee }) => {
  const contactName = employee?.emergencyContactName || employee?.emergencyContact;
  const contactRelation = employee?.emergencyContactRelation || employee?.emergencyRelationship;
  const contactPhone = employee?.emergencyContactPhone || employee?.emergencyPhone || employee?.emergencyMobile;
  const contactEmail = employee?.emergencyContactEmail || employee?.emergencyEmail;
  const hasContact = contactName || contactRelation || contactPhone || contactEmail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Emergency Contact</h3>
      </div>
      {hasContact ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4 mb-2">
            <Users className="w-8 h-8 text-blue-600" />
            <span className="text-gray-900 text-lg font-semibold">{contactName || 'Not provided'}</span>
            {contactRelation && (
              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">{contactRelation}</span>
            )}
          </div>
          <div className="space-y-2 mt-2">
            {contactPhone && (
              <div className="flex items-center text-gray-600">
                <Phone className="w-4 h-4 mr-2 text-gray-400" />
                <a href={`tel:${contactPhone}`} className="hover:text-blue-600 transition-colors">{contactPhone}</a>
              </div>
            )}
            {contactEmail && (
              <div className="flex items-center text-gray-600">
                <Mail className="w-4 h-4 mr-2 text-gray-400" />
                <a href={`mailto:${contactEmail}`} className="hover:text-blue-600 transition-colors">{contactEmail}</a>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No emergency contact added.</h3>
        </div>
      )}
    </div>
  );
};

// Documents Tab with Document Manager
const DocumentsTab = ({ employee }) => {
  const { user } = useAuth();
  // Check multiple possible data structures
  const folders = employee?.folders || employee?.documents || employee?.documentFolders || [];
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    file: null,
    category: 'other',
    description: ''
  });
  const [uploading, setUploading] = useState(false);

  console.log("DocumentsTab - folders:", folders);

  const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';

  const handleFolderClick = (folder) => {
    setSelectedFolder(folder);
    setDocuments(folder?.documents || folder?.files || []);
  };

  const handleBackToFolders = () => {
    setSelectedFolder(null);
    setDocuments([]);
  };

  const handleDownload = (doc) => {
    if (doc.fileUrl) {
      // Open document URL in new tab
      window.open(buildDirectUrl(doc.fileUrl), '_blank');
    }
  };

  const handleUpload = () => {
    if (!isAdmin) {
      alert('Only administrators can upload documents');
      return;
    }
    setShowUploadModal(true);
  };

  const handleUploadSubmit = async () => {
    if (!uploadForm.file) {
      alert('Please select a file');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('category', uploadForm.category);
      if (uploadForm.description) {
        formData.append('description', uploadForm.description);
      }

      const token = localStorage.getItem('auth_token');
      await axios.post(
        buildApiUrl(`/documentManagement/employees/${employee._id}/upload`),
        formData,
        {
          headers: { 
            'Content-Type': 'multipart/form-data',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          withCredentials: true
        }
      );

      alert('Document uploaded successfully');
      setShowUploadModal(false);
      setUploadForm({ file: null, category: 'other', description: '' });
      
      // Refresh employee data
      window.location.reload();
    } catch (error) {
      console.error('Upload error:', error);
      alert(error.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = (doc) => {
    setDocumentToDelete(doc);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;
    
    try {
      // Call delete API
      await axios.delete(buildApiUrl(`/documentManagement/documents/${documentToDelete.id}`));
      
      // Refresh documents
      setDocuments(documents.filter(d => d.id !== documentToDelete.id));
      setShowDeleteModal(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  if (!folders || folders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
          {isAdmin && (
            <button
              onClick={handleUpload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </button>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found.</h3>
          <p className="text-sm text-gray-500">Documents will appear here once they are uploaded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
        {selectedFolder && isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Upload</span>
            </button>
          </div>
        )}
      </div>
      {!selectedFolder ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {folders.map((folder) => (
            <div
              key={folder?.id || folder?._id}
              onClick={() => handleFolderClick(folder)}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-4">
                <FolderOpen className="w-10 h-10 text-blue-600 group-hover:text-blue-700 transition-colors" />
                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                  {folder?.documents?.length || 0} files
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {folder?.name || 'Unnamed Folder'}
              </h4>
              <p className="text-sm text-gray-500">
                Last updated: {folder?.documents?.[0]?.uploaded || 'N/A'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToFolders}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back
              </button>
              <div>
                <h4 className="font-semibold text-gray-900">{selectedFolder?.name || 'Unnamed Folder'}</h4>
                <p className="text-sm text-gray-500">{documents?.length || 0} documents</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {documents && documents.length > 0 ? documents.map((doc) => (
              <div key={doc?.id || doc?._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900">{doc?.name || 'Unnamed Document'}</h5>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <span>{doc?.size || 'Unknown size'}</span>
                        <span>•</span>
                        <span>Uploaded {doc?.uploaded || 'Unknown'}</span>
                        {doc?.version && (
                          <>
                            <span>•</span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              {doc.version}
                            </span>
                          </>
                        )}
                        {doc?.expiry && (
                          <>
                            <span>•</span>
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                              Expires {doc.expiry}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => handleDownload(doc)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Download document"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteDocument(doc)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-4 text-center text-gray-500">No documents in this folder.</div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload Document</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadForm({ file: null, category: 'other', description: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File *
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="other">Other</option>
                  <option value="passport">Passport</option>
                  <option value="visa">Visa</option>
                  <option value="contract">Contract</option>
                  <option value="certificate">Certificate</option>
                  <option value="id_proof">ID Proof</option>
                  <option value="resume">Resume</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add notes about this document..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadForm({ file: null, category: 'other', description: '' });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={uploading || !uploadForm.file}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Document</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{documentToDelete?.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDocumentToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeProfile;
