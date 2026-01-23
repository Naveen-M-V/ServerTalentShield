import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Edit3, Save, X, Users, Search, ChevronDown, ChevronRight } from 'lucide-react';
import axios from '../utils/axiosConfig';
import { toast } from 'react-toastify';

// Avatar Component
const Avatar = ({ employee, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg'
  };

  const initials = `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`.toUpperCase();
  
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg border-4 border-white`}>
      {employee.avatar ? (
        <img src={employee.avatar} alt={`${employee.firstName} ${employee.lastName}`} className="w-full h-full rounded-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
};

// Employee Card Component
const EmployeeCard = ({ employee, onClick, isSelected, isDragging, canDrag }) => {
  const directReportsCount = employee.directReports?.length || 0;
  
  return (
    <div
      draggable={canDrag}
      onClick={onClick}
      className={`bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-200 p-4 min-w-[220px] max-w-[240px] cursor-pointer border-2 
        ${isSelected ? 'border-blue-500 ring-4 ring-blue-100' : 'border-gray-200'}
        ${isDragging ? 'opacity-50 scale-95' : 'hover:scale-105'}
        ${canDrag ? 'cursor-move' : 'cursor-pointer'}`}
    >
      <div className="flex flex-col items-center">
        <Avatar employee={employee} size="md" />
        
        <div className="mt-3 text-center">
          <h3 className="text-base font-bold text-gray-900 leading-tight">
            {employee.firstName} {employee.lastName}
          </h3>
          <p className="text-xs text-gray-600 mt-1">{employee.jobTitle || 'No Title'}</p>
          <p className="text-xs text-gray-500 mt-0.5">{employee.department || 'No Department'}</p>
        </div>

        {directReportsCount > 0 && (
          <div className="mt-3 px-3 py-1 bg-blue-50 rounded-full">
            <span className="text-xs font-semibold text-blue-700">
              {directReportsCount} {directReportsCount === 1 ? 'report' : 'reports'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Tree Node Component (Recursive)
const TreeNode = ({ 
  employee, 
  level = 0, 
  isEditable, 
  onEmployeeClick, 
  selectedEmployee,
  draggedEmployee,
  onDragStart,
  onDragOver,
  onDrop,
  collapsedNodes,
  onToggleCollapse
}) => {
  const hasReports = employee.directReports && employee.directReports.length > 0;
  const isCollapsed = collapsedNodes.includes(employee.id);
  const isDragging = draggedEmployee?.id === employee.id;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <EmployeeCard
          employee={employee}
          onClick={() => onEmployeeClick(employee)}
          isSelected={selectedEmployee?.id === employee.id}
          isDragging={isDragging}
          canDrag={isEditable}
          onDragStart={(e) => isEditable && onDragStart(e, employee)}
        />
        
        {hasReports && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(employee.id);
            }}
            className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors z-10"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 rotate-90" />}
          </button>
        )}
      </div>

      {!isCollapsed && hasReports && (
        <div className="relative mt-12">
          {/* Vertical line from parent */}
          <div className="absolute top-0 left-1/2 w-0.5 h-8 bg-gray-300 -translate-x-1/2 -translate-y-8"></div>

          {/* Horizontal line connecting all children */}
          {employee.directReports.length > 1 && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-300"></div>
          )}

          <div className="flex gap-12 relative">
            {employee.directReports.map((report, index) => (
              <div key={report.id} className="relative">
                {/* Vertical line to each child */}
                <div className="absolute -top-8 left-1/2 w-0.5 h-8 bg-gray-300 -translate-x-1/2"></div>
                
                <div
                  onDragOver={(e) => isEditable && onDragOver(e, report)}
                  onDrop={(e) => isEditable && onDrop(e, report)}
                >
                  <TreeNode
                    employee={report}
                    level={level + 1}
                    isEditable={isEditable}
                    onEmployeeClick={onEmployeeClick}
                    selectedEmployee={selectedEmployee}
                    draggedEmployee={draggedEmployee}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    collapsedNodes={collapsedNodes}
                    onToggleCollapse={onToggleCollapse}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Employee Selection Panel
const EmployeeSelectionPanel = ({ employees, onSelectEmployee, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredEmployees = employees.filter(emp =>
    `${emp.firstName} ${emp.lastName} ${emp.jobTitle} ${emp.department}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Select New Manager</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-3">
            {filteredEmployees.map(employee => (
              <button
                key={employee.id}
                onClick={() => onSelectEmployee(employee)}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <Avatar employee={employee} size="sm" />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">
                    {employee.firstName} {employee.lastName}
                  </div>
                  <div className="text-sm text-gray-600">{employee.jobTitle}</div>
                  <div className="text-xs text-gray-500">{employee.department}</div>
                </div>
              </button>
            ))}
          </div>
          
          {filteredEmployees.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              No employees found matching "{searchTerm}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Organizational Chart Component
const OrganizationalChartNew = () => {
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isEditable, setIsEditable] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [allEmployees, setAllEmployees] = useState([]);
  const [orgChartData, setOrgChartData] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [draggedEmployee, setDraggedEmployee] = useState(null);
  const [showEmployeeSelector, setShowEmployeeSelector] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState([]);
  const [pendingChanges, setPendingChanges] = useState(new Map());

  // Load organizational chart from backend
  useEffect(() => {
    fetchOrganizationalChart();
  }, []);

  const fetchOrganizationalChart = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/employees/org-chart');
      
      if (response.data.success) {
        // Normalize data: convert _id to id for consistency
        const normalizeEmployee = (emp) => ({
          ...emp,
          id: emp.id || emp._id?.toString() || emp._id,
          directReports: emp.directReports?.map(normalizeEmployee) || []
        });
        
        const normalizedData = (response.data.data || []).map(normalizeEmployee);
        setOrgChartData(normalizedData);
      }
    } catch (error) {
      console.error('Error fetching org chart:', error);
      toast.error('Failed to load organizational chart');
    } finally {
      setLoading(false);
    }
  };

  // Load all employees for selection
  const fetchAllEmployees = async () => {
    try {
      const response = await axios.get('/api/employees/hub/all');
      if (response.data.success) {
        // Normalize: ensure id field exists
        const normalized = (response.data.data || []).map(emp => ({
          ...emp,
          id: emp.id || emp._id?.toString() || emp._id
        }));
        setAllEmployees(normalized);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    }
  };

  const handleEditToggle = async () => {
    if (!isEditable) {
      // Entering edit mode - load all employees
      await fetchAllEmployees();
      setIsEditable(true);
    } else {
      // Exiting edit mode
      if (hasChanges) {
        if (window.confirm('You have unsaved changes. Do you want to discard them?')) {
          setPendingChanges(new Map());
          setHasChanges(false);
          setIsEditable(false);
          await fetchOrganizationalChart();
        }
      } else {
        setIsEditable(false);
      }
    }
  };

  const handleDragStart = (e, employee) => {
    setDraggedEmployee(employee);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetEmployee) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, newManager) => {
    e.preventDefault();
    
    if (!draggedEmployee || draggedEmployee.id === newManager.id) {
      setDraggedEmployee(null);
      return;
    }

    // Prevent circular reporting (can't report to your own subordinate)
    if (isSubordinate(draggedEmployee, newManager)) {
      toast.error('Cannot create circular reporting relationship!');
      setDraggedEmployee(null);
      return;
    }

    // Update pending changes
    const newChanges = new Map(pendingChanges);
    newChanges.set(draggedEmployee.id, newManager.id);
    setPendingChanges(newChanges);
    setHasChanges(true);

    // Update org chart data locally
    updateLocalOrgChart(draggedEmployee.id, newManager.id);
    
    toast.success(`${draggedEmployee.firstName} ${draggedEmployee.lastName} will now report to ${newManager.firstName} ${newManager.lastName}`);
    setDraggedEmployee(null);
  };

  const isSubordinate = (potentialManager, employee) => {
    if (!employee.directReports || employee.directReports.length === 0) {
      return false;
    }
    
    for (const report of employee.directReports) {
      if (report.id === potentialManager.id) {
        return true;
      }
      if (isSubordinate(potentialManager, report)) {
        return true;
      }
    }
    
    return false;
  };

  const updateLocalOrgChart = (employeeId, newManagerId) => {
    // This function updates the local state to reflect the change
    // We'll need to rebuild the hierarchy
    fetchOrganizationalChart();
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Convert pending changes to array format
      const managerRelationships = Array.from(pendingChanges.entries()).map(([employeeId, managerId]) => ({
        employeeId,
        managerId
      }));

      // Save to backend
      const response = await axios.post('/api/employees/org-chart/save', {
        managerRelationships
      });

      if (response.data.success) {
        toast.success('Organizational chart saved successfully!');
        setPendingChanges(new Map());
        setHasChanges(false);
        setIsEditable(false);
        await fetchOrganizationalChart();
      }
    } catch (error) {
      console.error('Error saving org chart:', error);
      toast.error(error.response?.data?.message || 'Failed to save organizational chart');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCollapse = (employeeId) => {
    setCollapsedNodes(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleAssignToRoot = () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }

    setShowEmployeeSelector(true);
  };

  const handleSelectNewManager = (newManager) => {
    if (!selectedEmployee) return;

    // Prevent self-assignment
    if (selectedEmployee.id === newManager.id) {
      toast.error('Employee cannot be their own manager!');
      return;
    }

    // Prevent circular reporting
    if (isSubordinate(selectedEmployee, newManager)) {
      toast.error('Cannot create circular reporting relationship!');
      return;
    }

    const newChanges = new Map(pendingChanges);
    newChanges.set(selectedEmployee.id, newManager.id);
    setPendingChanges(newChanges);
    setHasChanges(true);

    updateLocalOrgChart(selectedEmployee.id, newManager.id);
    
    toast.success(`${selectedEmployee.firstName} ${selectedEmployee.lastName} will now report to ${newManager.firstName} ${newManager.lastName}`);
    setShowEmployeeSelector(false);
    setSelectedEmployee(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading organizational chart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Organizational Chart</h1>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {isEditable 
                ? 'Drag and drop employees to reorganize reporting structure' 
                : 'View your organization\'s reporting hierarchy'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isEditable && (
              <>
                {selectedEmployee && (
                  <button
                    onClick={handleAssignToRoot}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Change Manager
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </>
            )}
            
            <button
              onClick={handleEditToggle}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                isEditable
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isEditable ? (
                <>
                  <X className="w-4 h-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  Edit
                </>
              )}
            </button>

            <div className="flex items-center gap-2 border-l border-gray-300 pl-3 ml-3">
              <button
                onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5 text-gray-600" />
              </button>
              <span className="text-sm font-medium text-gray-600 min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {hasChanges && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ You have {pendingChanges.size} unsaved change{pendingChanges.size !== 1 ? 's' : ''}. Don't forget to save!
            </p>
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 overflow-auto" style={{ minHeight: '70vh' }}>
        {orgChartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <Users className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Organizational Structure</h3>
            <p className="text-gray-600 mb-6">Start building your org chart by adding employees and assigning managers</p>
            {isEditable && (
              <button
                onClick={() => setShowEmployeeSelector(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Add Employee to Chart
              </button>
            )}
          </div>
        ) : (
          <div
            className="flex justify-center transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          >
            <div className="flex gap-16">
              {orgChartData.map(rootEmployee => (
                <TreeNode
                  key={rootEmployee.id}
                  employee={rootEmployee}
                  isEditable={isEditable}
                  onEmployeeClick={setSelectedEmployee}
                  selectedEmployee={selectedEmployee}
                  draggedEmployee={draggedEmployee}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  collapsedNodes={collapsedNodes}
                  onToggleCollapse={handleToggleCollapse}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Employee Selection Modal */}
      {showEmployeeSelector && (
        <EmployeeSelectionPanel
          employees={allEmployees}
          onSelectEmployee={handleSelectNewManager}
          onClose={() => setShowEmployeeSelector(false)}
        />
      )}
    </div>
  );
};

export default OrganizationalChartNew;
