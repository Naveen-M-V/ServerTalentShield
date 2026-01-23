import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarDaysIcon,
  UserIcon,
  FunnelIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const ManagerApprovalDashboard = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, Sick, Casual, etc.
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [adminComment, setAdminComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    setLoading(true);
    setError('');

    try {
      // Get current user from localStorage or auth context
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Fetch all pending requests (unified system sends to all admins)
      const response = await axios.get('/api/leave/pending-requests');

      setPendingRequests(response.data.data || []);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      setError(error.response?.data?.message || 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      const response = await axios.patch(
        `/api/leave/approve/${selectedRequest._id}`,
        {
          adminComment
        }
      );

      if (response.data.success) {
        // notification handled by backend
        setShowApprovalModal(false);
        setSelectedRequest(null);
        setAdminComment('');
        fetchPendingRequests(); // Refresh list
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert(error.response?.data?.message || 'Failed to approve leave request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setActionLoading(true);
    try {
      const response = await axios.patch(
        `/api/leave/reject/${selectedRequest._id}`,
        {
          rejectionReason
        }
      );

      if (response.data.success) {
        // notification handled by backend
        setShowRejectionModal(false);
        setSelectedRequest(null);
        setRejectionReason('');
        fetchPendingRequests(); // Refresh list
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert(error.response?.data?.message || 'Failed to reject leave request');
    } finally {
      setActionLoading(false);
    }
  };

  const openApprovalModal = (request) => {
    setSelectedRequest(request);
    setShowApprovalModal(true);
    setAdminComment('');
  };

  const openRejectionModal = (request) => {
    setSelectedRequest(request);
    setShowRejectionModal(true);
    setRejectionReason('');
  };

  const filteredRequests = pendingRequests.filter(request => {
    // Filter by type
    if (filter !== 'all' && request.leaveType !== filter) return false;

    // Filter by search term
    if (searchTerm) {
      const employeeName = `${request.employeeId?.firstName || ''} ${request.employeeId?.lastName || ''}`.toLowerCase();
      const employeeIdCode = request.employeeId?.vtid || '';
      const searchLower = searchTerm.toLowerCase();

      return employeeName.includes(searchLower) || employeeIdCode.toLowerCase().includes(searchLower);
    }

    return true;
  });

  const getLeaveTypeColor = (type) => {
    switch (type) {
      case 'Casual':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Sick':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Unpaid':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Maternity':
      case 'Paternity':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leave Approval Dashboard</h1>
        <p className="text-gray-600">Review and approve pending leave requests from your team</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by employee name or VTID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filter by type */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="Casual">Casual</option>
              <option value="Sick">Sick</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Maternity">Maternity</option>
              <option value="Paternity">Paternity</option>
              <option value="Bereavement">Bereavement</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchPendingRequests}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading pending requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Requests</h3>
          <p className="text-gray-600">
            {searchTerm || filter !== 'all'
              ? 'No requests match your current filters'
              : 'All leave requests have been processed'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => (
                  <tr key={request._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <UserIcon className="h-6 w-6 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {request.employeeId?.firstName} {request.employeeId?.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {request.employeeId?.vtid || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getLeaveTypeColor(request.leaveType)}`}>
                        {request.leaveType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-1">
                        <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                        <span>
                          {new Date(request.startDate).toLocaleDateString('en-GB')} - {new Date(request.endDate).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.numberOfDays} days
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={request.reason}>
                        {request.reason || 'No reason provided'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openApprovalModal(request)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => openRejectionModal(request)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                          <XCircleIcon className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-green-900">Approve Leave Request</h2>

            <div className="mb-4 bg-green-50 border border-green-200 rounded p-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Employee:</strong> {selectedRequest.employeeId?.firstName} {selectedRequest.employeeId?.lastName}
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Type:</strong> {selectedRequest.leaveType}
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Duration:</strong> {selectedRequest.numberOfDays} days
              </p>
              <p className="text-sm text-gray-700">
                <strong>Dates:</strong> {new Date(selectedRequest.startDate).toLocaleDateString('en-GB')} - {new Date(selectedRequest.endDate).toLocaleDateString('en-GB')}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Approval Notes (Optional)
              </label>
              <textarea
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                rows="3"
                placeholder="Add any notes or comments..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Approving...' : 'Confirm Approval'}
              </button>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-red-900">Reject Leave Request</h2>

            <div className="mb-4 bg-red-50 border border-red-200 rounded p-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Employee:</strong> {selectedRequest.employeeId?.firstName} {selectedRequest.employeeId?.lastName}
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Type:</strong> {selectedRequest.leaveType}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Dates:</strong> {new Date(selectedRequest.startDate).toLocaleDateString('en-GB')} - {new Date(selectedRequest.endDate).toLocaleDateString('en-GB')}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                rows="4"
                placeholder="Please provide a clear reason for rejection..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                The employee will receive this reason via email.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                onClick={() => setShowRejectionModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerApprovalDashboard;
