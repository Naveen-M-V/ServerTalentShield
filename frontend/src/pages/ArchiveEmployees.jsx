import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

export default function ArchiveEmployees() {
  const [archivedEmployees, setArchivedEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Fetch archived employees
  const fetchArchivedEmployees = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/employees/archived`);
      console.log('🔍 Archived employees response:', response);
      console.log('🔍 Response data:', response.data);
      console.log('🔍 Response success:', response.data.success);
      console.log('🔍 Archived employees count:', response.data.count);
      console.log('🔍 Archived employees array:', response.data.data);
      if (response.data.success) {
        setArchivedEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching archived employees:', error);
      console.error('Error details:', error.response?.data);
      // Don't show alert for network errors, just log them
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedEmployees();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return '-';
    }
  };

  const closeEmployeeModal = () => {
    setSelectedEmployee(null);
    setIsExportMenuOpen(false);
  };

  const getOrganisationName = (employee) => {
    if (!employee) return '-';
    return employee.organisationName || employee.OrganisationName || employee.office || '-';
  };

  const csvEscape = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const downloadBlob = (content, mimeType, filename) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportEmployeeCsv = (employee) => {
    if (!employee) return;

    const headers = [
      'Name',
      'Date of Birth',
      'Gender',
      'Email',
      'Mobile Number',
      'Team',
      'Organisation Name',
      'Job Title',
      'Department',
      'Start Date',
      'End Date',
      'Termination Reason',
      'Status'
    ];

    const values = [
      `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
      formatDate(employee.dateOfBirth),
      employee.gender || '-',
      employee.email || '-',
      employee.phone || '-',
      employee.team || '-',
      getOrganisationName(employee),
      employee.jobTitle || '-',
      employee.department || '-',
      formatDate(employee.startDate),
      formatDate(employee.exitDate || employee.terminatedDate),
      employee.terminationReason || employee.terminationNote || '-',
      employee.status || '-'
    ];

    const csv = [headers, values]
      .map((row) => row.map(csvEscape).join(','))
      .join('\n');

    const safeName = (`${employee.firstName || 'employee'}_${employee.lastName || ''}`)
      .trim()
      .replace(/\s+/g, '_');
    downloadBlob(csv, 'text/csv;charset=utf-8;', `archived_employee_${safeName}.csv`);
  };

  const exportEmployeePdf = (employee) => {
    if (!employee) return;

    const name = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Employee';
    const rows = [
      ['Name', name],
      ['Date of Birth', formatDate(employee.dateOfBirth)],
      ['Gender', employee.gender || '-'],
      ['Email', employee.email || '-'],
      ['Mobile Number', employee.phone || '-'],
      ['Team', employee.team || '-'],
      ['Organisation Name', getOrganisationName(employee)],
      ['Job Title', employee.jobTitle || '-'],
      ['Department', employee.department || '-'],
      ['Start Date', formatDate(employee.startDate)],
      ['End Date', formatDate(employee.exitDate || employee.terminatedDate)],
      ['Termination Reason', employee.terminationReason || employee.terminationNote || '-'],
      ['Status', employee.status || '-']
    ];

    const tableRowsHtml = rows
      .map(
        ([label, value]) => `
          <tr>
            <td class="label">${String(label)}</td>
            <td class="value">${String(value ?? '-')}</td>
          </tr>
        `
      )
      .join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${name} - Archived Employee</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { font-size: 18px; margin: 0 0 16px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 12px; vertical-align: top; }
            td.label { width: 240px; background: #f9fafb; color: #374151; font-weight: 600; }
            td.value { color: #111827; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Archived Employee Details</h1>
          <table>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      iframe.remove();
      toast.error('Unable to export PDF. Please try again.');
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } finally {
        setTimeout(() => iframe.remove(), 1000);
      }
    }, 250);
  };

  // Handle bulk delete of archived employees
  const handleBulkDelete = async () => {
    if (selectedEmployees.length === 0) {
      toast.warning('Please select at least one employee to delete.');
      return;
    }

    const confirmMessage = `Are you sure you want to permanently delete ${selectedEmployees.length} archived employee record(s)?\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await axios.delete(
        `${process.env.REACT_APP_API_BASE_URL}/employees/archived/bulk`,
        {
          data: { ids: selectedEmployees }
        }
      );

      if (response.data.success) {
        toast.success(`Successfully deleted ${response.data.deletedCount} archived employee(s)`);
        
        // Remove deleted employees from UI state
        setArchivedEmployees(prev => 
          prev.filter(emp => !selectedEmployees.includes(emp._id))
        );
        
        // Reset selection
        setSelectedEmployees([]);
      }
    } catch (error) {
      console.error('Error deleting archived employees:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete archived employees';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Archived Employees</h1>
        <p className="text-gray-600 mt-1">
          Permanently deleted employees - Read Only View
        </p>
      </div>

      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6" onClick={closeEmployeeModal}>
          <div className="w-full max-w-xl bg-white rounded-lg shadow max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b flex-none">
              <div className="text-lg font-semibold text-gray-900">Archived Employee Details</div>
              <button onClick={closeEmployeeModal} className="p-2 text-gray-600 hover:text-gray-800">
                <span className="text-xl leading-none">×</span>
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Name</div>
                  <div className="font-medium text-gray-900">{selectedEmployee.firstName} {selectedEmployee.lastName}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500">Date of Birth</div>
                  <div className="font-medium text-gray-900">{formatDate(selectedEmployee.dateOfBirth)}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500">Gender</div>
                  <div className="font-medium text-gray-900">{selectedEmployee.gender || '-'}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500">Email</div>
                  <div className="font-medium text-gray-900">{selectedEmployee.email || '-'}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500">Mobile number</div>
                  <div className="font-medium text-gray-900">{selectedEmployee.phone || '-'}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500">Team</div>
                  <div className="font-medium text-gray-900">{selectedEmployee.team || '-'}</div>
                </div>

                <div className="sm:col-span-2">
                  <div className="text-sm text-gray-500">Organisation name</div>
                  <div className="font-medium text-gray-900">{getOrganisationName(selectedEmployee)}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500">Job title</div>
                  <div className="font-medium text-gray-900">{selectedEmployee.jobTitle || '-'}</div>
                </div>

                <div className="sm:col-span-2">
                  <div className="text-sm text-gray-500">Termination reason</div>
                  <div className="font-medium text-gray-900">{selectedEmployee.terminationReason || selectedEmployee.terminationNote || '-'}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500">Start date</div>
                  <div className="font-medium text-gray-900">{formatDate(selectedEmployee.startDate)}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500">End date</div>
                  <div className="font-medium text-gray-900">{formatDate(selectedEmployee.exitDate || selectedEmployee.terminatedDate)}</div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex items-center justify-end gap-2 flex-none">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsExportMenuOpen((prev) => !prev)}
                  className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Export
                </button>
                {isExportMenuOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-36 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10">
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        exportEmployeePdf(selectedEmployee);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-gray-50"
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        exportEmployeeCsv(selectedEmployee);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-gray-50"
                    >
                      CSV
                    </button>
                  </div>
                )}
              </div>

              <button onClick={closeEmployeeModal} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-gray-100 rounded-lg p-3">
              <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Total Archived</h3>
              <p className="text-2xl font-bold text-gray-600">{archivedEmployees.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-red-100 rounded-lg p-3">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Recently Deleted</h3>
              <p className="text-2xl font-bold text-red-600">
                {archivedEmployees.filter(emp => {
                  const deletedDate = new Date(emp.deletedDate);
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return deletedDate > weekAgo;
                }).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">This Month</h3>
              <p className="text-2xl font-bold text-blue-600">
                {archivedEmployees.filter(emp => {
                  const deletedDate = new Date(emp.deletedDate);
                  const thisMonth = new Date();
                  thisMonth.setDate(1);
                  return deletedDate >= thisMonth;
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Archived Employees Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Archived Employees List</h2>
          
          {/* Delete Button */}
          {selectedEmployees.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDeleting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Selected ({selectedEmployees.length})
                </>
              )}
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Loading archived employees...</p>
          </div>
        ) : archivedEmployees.length === 0 ? (
          <div className="p-6 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No archived employees</h3>
            <p className="mt-1 text-sm text-gray-500">No permanently deleted employees found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedEmployees.length === archivedEmployees.length && archivedEmployees.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmployees(archivedEmployees.map(emp => emp._id));
                        } else {
                          setSelectedEmployees([]);
                        }
                      }}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SI Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason of Termination
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    End Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {archivedEmployees.map((employee, index) => (
                  <tr 
                    key={employee._id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedEmployee(employee)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={selectedEmployees.includes(employee._id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedEmployees([...selectedEmployees, employee._id]);
                          } else {
                            setSelectedEmployees(selectedEmployees.filter(id => id !== employee._id));
                          }
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{employee.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {employee.terminationReason || employee.terminationNote || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(employee.startDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(employee.exitDate || employee.terminatedDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
