import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  MagnifyingGlassIcon,
  EyeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserGroupIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { formatDateDDMMYY } from "../utils/dateFormatter";
import { useAlert } from "../components/AlertNotification";

export default function EmployeeHub() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success, error } = useAlert();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState("All");
  const [sortBy, setSortBy] = useState("First name (A - Z)");
  const [status, setStatus] = useState("All");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState({});
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  // Employees data from API
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  // Teams data from API
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // Bulk delete state
  const [selectedEmployees, setSelectedEmployees] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch employees from EmployeesHub schema
  const fetchAllEmployees = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/employees?includeAdmins=true`);
      if (response.data.success) {
        const employees = response.data.data;
        setAllEmployees(employees);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load employees and teams on component mount
  useEffect(() => {
    fetchAllEmployees();
    fetchTeams();
  }, []);

  const handleViewProfile = (employeeId) => {
    console.log('handleViewProfile called with ID:', employeeId);
    
    // Navigate to the new employee profile page
    navigate(`/employee/${employeeId}`);
  };

  // Toggle employee selection
  const toggleEmployeeSelection = (employeeId) => {
    setSelectedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  // Toggle all employees selection
  const toggleAllEmployees = () => {
    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map(e => e._id)));
    }
  };

  // Bulk delete employees
  const handleBulkDelete = async () => {
    if (selectedEmployees.size === 0) return;
    
    try {
      const employeeIds = Array.from(selectedEmployees);
      const response = await axios.delete(`${process.env.REACT_APP_API_BASE_URL}/employees/bulk`, {
        data: { employeeIds }
      });

      if (response.data.success) {
        // Refresh employee list
        await fetchAllEmployees();
        setSelectedEmployees(new Set());
        setShowDeleteConfirm(false);
        success(`Successfully deleted ${employeeIds.length} employee(s)`);
      }
    } catch (error) {
      console.error('Error deleting employees:', error);
      error('Failed to delete employees. Please try again.');
    }
  };

  // Listen for refresh parameter to reload data after edits
  useEffect(() => {
    const refreshParam = searchParams.get('refresh');
    
    if (refreshParam) {
      console.log('Refreshing employee data after edit');
      fetchAllEmployees();
      // Clean up the URL parameter
      navigate('/employee-hub', { replace: true });
    }
  }, [searchParams, navigate]);


  // Fetch teams from API
  const fetchTeams = async () => {
    setTeamsLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/teams`);
      if (response.data.success) {
        setTeams(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setTeamsLoading(false);
    }
  };

  const toggleTeam = (teamName) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [teamName]: !prev[teamName],
    }));
  };

  // Format date helper function
  const formatDate = (dateString) => {
    const formatted = formatDateDDMMYY(dateString);
    return formatted || "-";
  };

  // Enhanced filtering and sorting logic
  const getFilteredAndSortedData = () => {
    let filteredData = [];
    
    // Apply filter by type
    if (filterBy === "Employees" || filterBy === "All") {
      let employeeData = allEmployees.filter((emp) => {
        const matchesSearch = searchTerm === "" ||
          emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.department.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = status === "All" || emp.status === status;
        
        return matchesSearch && matchesStatus;
      });
      
      filteredData = [...employeeData.map(emp => ({ ...emp, type: 'employee' }))];
    }
    
    if (filterBy === "Teams" || filterBy === "All") {
      let teamData = teams.filter((team) => {
        const matchesSearch = searchTerm === "" ||
          team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          team.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          team.department?.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesSearch;
      });
      
      filteredData = [...filteredData, ...teamData.map(team => ({ ...team, type: 'team' }))];
    }
    
    // Apply sorting
    filteredData.sort((a, b) => {
      switch (sortBy) {
        case "First name (A - Z)":
          const aFirstName = a.type === 'employee' ? a.firstName : a.name;
          const bFirstName = b.type === 'employee' ? b.firstName : b.name;
          return aFirstName.localeCompare(bFirstName);
        case "First name (Z - A)":
          const aFirstNameDesc = a.type === 'employee' ? a.firstName : a.name;
          const bFirstNameDesc = b.type === 'employee' ? b.firstName : b.name;
          return bFirstNameDesc.localeCompare(aFirstNameDesc);
        case "Last name (A - Z)":
          if (a.type === 'employee' && b.type === 'employee') {
            return a.lastName.localeCompare(b.lastName);
          }
          return 0;
        case "Last name (Z - A)":
          if (a.type === 'employee' && b.type === 'employee') {
            return b.lastName.localeCompare(a.lastName);
          }
          return 0;
        default:
          return 0;
      }
    });
    
    return filteredData;
  };
  
  const filteredAndSortedData = getFilteredAndSortedData();
  const filteredEmployees = filteredAndSortedData.filter(item => item.type === 'employee');
  const filteredTeams = filteredAndSortedData.filter(item => item.type === 'team');

  const getTeamEmployees = (teamName) => {
    // Filter employees by team name from their team field
    return allEmployees.filter((emp) => emp.team === teamName);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Page Title */}
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Employees</h1>

      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/add-employee")}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
            >
              Add employees
            </button>
            
            {selectedEmployees.size > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Selected ({selectedEmployees.size})
              </button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Find
            </label>
            <div className="relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder={filterBy === "Teams" ? "Search teams..." : filterBy === "Employees" ? "Search employees..." : "Search employees and teams..."}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSearchDropdown(e.target.value.length > 0);
                  }}
                  onFocus={() => setShowSearchDropdown(searchTerm.length > 0)}
                  onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                
                {/* Search Dropdown */}
                {showSearchDropdown && searchTerm && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredAndSortedData.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        No results found
                      </div>
                    ) : (
                      filteredAndSortedData.slice(0, 10).map((item) => (
                        <div
                          key={`${item.type}-${item._id}`}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => {
                            if (item.type === 'employee') {
                              handleViewProfile(item._id);
                            } else {
                              toggleTeam(item.name);
                            }
                            setShowSearchDropdown(false);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {item.type === 'employee' ? (
                              <>
                                <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0">
                                  {item.profilePhoto ? (
                                    <img
                                      src={item.profilePhoto}
                                      alt={`${item.firstName} ${item.lastName}`}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div
                                      className="h-full w-full flex items-center justify-center text-white font-medium text-sm"
                                      style={{ backgroundColor: item.color || '#3B82F6' }}
                                    >
                                      {item.initials || `${item.firstName?.charAt(0) || ''}${item.lastName?.charAt(0) || ''}`}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {item.firstName} {item.lastName}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {item.jobTitle} • {item.department}
                                  </div>
                                </div>
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                  Employee
                                </span>
                              </>
                            ) : (
                              <>
                                <div
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0"
                                  style={{ backgroundColor: item.color || '#3B82F6' }}
                                >
                                  {item.initials || item.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {getTeamEmployees(item.name).length} members
                                  </div>
                                </div>
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                  Team
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by
            </label>
            <Select value={filterBy} onValueChange={setFilterBy}>
              <SelectTrigger className="w-full h-[42px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Employees">Employees</SelectItem>
                <SelectItem value="Teams">Teams</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort by
            </label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full h-[42px]">
                <SelectValue placeholder="First name (A - Z)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="First name (A - Z)">First name (A - Z)</SelectItem>
                <SelectItem value="First name (Z - A)">First name (Z - A)</SelectItem>
                <SelectItem value="Last name (A - Z)">Last name (A - Z)</SelectItem>
                <SelectItem value="Last name (Z - A)">Last name (Z - A)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full h-[42px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Employee List Section */}
      <div className="mb-6">
        <button
          onClick={() => setShowEmployeeList(!showEmployeeList)}
          className="flex items-center justify-between w-full text-left mb-4 group bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <UserGroupIcon className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-semibold text-gray-900">
              {filterBy === "Teams" ? `List of Teams (${filteredTeams.length})` : 
               filterBy === "Employees" ? `List of Employees (${filteredEmployees.length})` :
               `List of Employees (${filteredEmployees.length})`}
            </span>
          </div>
          {showEmployeeList ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-500 group-hover:text-gray-700" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-500 group-hover:text-gray-700" />
          )}
        </button>

        {/* View Toggle Buttons */}
        {showEmployeeList && (
          <div className="flex items-center justify-end gap-2 mb-4">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18m-9 8h9m-9 4h9m-9-8h9m-9 4h9" />
                </svg>
                Table
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Grid
              </button>
            </div>
          </div>
        )}

        {/* Employee Table/Grid */}
        {showEmployeeList && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {filterBy === "Teams" ? (
              // Teams Table View
              teamsLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading teams...</p>
                </div>
              ) : teams.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No teams found
                </div>
              ) : viewMode === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">S.No</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Team Name</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredTeams.map((team, index) => {
                        const teamMembers = getTeamEmployees(team.name);
                        return (
                          <tr key={team._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                  style={{ backgroundColor: team.color || '#3B82F6' }}
                                >
                                  {team.initials || team.name.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-gray-900">{team.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {team.department || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {teamMembers.length} member{(teamMembers.length || 0) !== 1 ? 's' : ''}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                              {team.description || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <button
                                onClick={() => toggleTeam(team.name)}
                                className="text-blue-600 hover:text-blue-800 mr-3"
                              >
                                View Members
                              </button>
                              <button
                                onClick={() => navigate(`/manage-teams?edit=${team._id}`)}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                // Teams Grid View
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                  {filteredTeams.map((team) => {
                    const teamMembers = getTeamEmployees(team.name);
                    return (
                      <div
                        key={team._id}
                        className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-all hover:border-gray-300"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div
                            className="h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                            style={{ backgroundColor: team.color || '#3B82F6' }}
                          >
                            {team.initials || team.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {team.name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {teamMembers.length} member{(teamMembers.length || 0) !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleTeam(team.name)}
                            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                          >
                            View Members
                          </button>
                          <button
                            onClick={() => navigate(`/manage-teams?edit=${team._id}`)}
                            className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700 transition-colors text-sm"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              // Employee Table/Grid View (existing code)
              loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading employees...</p>
                </div>
              ) : allEmployees.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No employees found
                </div>
              ) : viewMode === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={selectedEmployees.size === filteredEmployees.length && filteredEmployees.length > 0}
                            onChange={toggleAllEmployees}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                          />
                        </th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">S.No</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Team Name</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Job Role</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Documents</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredEmployees.map((employee, index) => {
                      const isTerminated = (employee.status || '').toLowerCase() === 'terminated';
                      const isSelected = selectedEmployees.has(employee._id);
                      return (
                      <tr 
                        key={employee._id} 
                        className={`hover:bg-gray-50 cursor-pointer ${
                          isTerminated ? 'bg-red-50 border-red-200' : ''
                        } ${isSelected ? 'bg-blue-50' : ''}`}
                        onClick={() => handleViewProfile(employee._id)}
                      >
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEmployeeSelection(employee._id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                          />
                        </td>
                        <td className={`px-6 py-4 text-sm ${
                          isTerminated ? 'text-red-700 font-medium' : 'text-gray-900'
                        }`}>{index + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0">
                              {employee.profilePhoto ? (
                                <img
                                  src={employee.profilePhoto}
                                  alt={`${employee.firstName} ${employee.lastName}`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div
                                  className={`h-full w-full flex items-center justify-center text-white font-medium text-sm ${
                                    isTerminated ? 'bg-red-600' : ''
                                  }`}
                                  style={{ backgroundColor: isTerminated ? '#DC2626' : (employee.color || '#3B82F6') }}
                                >
                                  {employee.initials || `${employee.firstName?.charAt(0) || ''}${employee.lastName?.charAt(0) || ''}`}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className={`font-medium ${
                                isTerminated ? 'text-red-700' : 'text-gray-900'
                              }`}>
                                {employee.firstName || '-'} {employee.lastName || '-'}
                              </div>
                              <div className={`text-xs ${
                                isTerminated ? 'text-red-600' : 'text-gray-500'
                              }`}>{employee.email || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 text-sm ${
                          isTerminated ? 'text-red-700' : 'text-gray-900'
                        }`}>{employee.team || '-'}</td>
                        <td className={`px-6 py-4 text-sm ${
                          isTerminated ? 'text-red-700' : 'text-gray-900'
                        }`}>{employee.jobTitle || '-'}</td>
                        <td className={`px-6 py-4 text-sm ${
                          isTerminated ? 'text-red-700' : 'text-gray-900'
                        }`}>{employee.department || '-'}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewProfile(employee._id);
                            }}
                            className={`inline-flex items-center gap-1 px-3 py-1 text-sm rounded transition-colors font-medium ${
                              isTerminated 
                                ? 'bg-red-600 text-white hover:bg-red-700' 
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                            title="View Profile"
                          >
                            <DocumentTextIcon className="h-4 w-4" />
                            View
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                {filteredEmployees.map((employee) => {
                  const isTerminated = (employee.status || '').toLowerCase() === 'terminated';
                  return (
                  <div
                    key={employee._id}
                    onClick={() => handleViewProfile(employee._id)}
                    className={`rounded-lg border p-4 hover:shadow-md transition-all cursor-pointer hover:border-gray-300 ${
                      isTerminated 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    {/* Employee Avatar */}
                    <div className="flex flex-col items-center text-center">
                      <div className="h-16 w-16 rounded-full overflow-hidden mb-3">
                        {employee.profilePhoto ? (
                          <img
                            src={employee.profilePhoto}
                            alt={`${employee.firstName} ${employee.lastName}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="h-full w-full flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: isTerminated ? '#DC2626' : (employee.color || '#3B82F6') }}
                          >
                            {employee.initials || `${employee.firstName?.charAt(0) || ''}${employee.lastName?.charAt(0) || ''}`}
                          </div>
                        )}
                      </div>
                      
                      {/* Employee Info */}
                      <div className="w-full">
                        <h3 className={`font-semibold truncate ${
                          isTerminated ? 'text-red-700' : 'text-gray-900'
                        }`}>
                          {employee.firstName || '-'} {employee.lastName || '-'}
                        </h3>
                        <p className={`text-sm truncate mt-1 ${
                          isTerminated ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {employee.jobTitle || '-'}
                        </p>
                        <p className={`text-sm truncate ${
                          isTerminated ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {employee.department || '-'}
                        </p>
                        <p className={`text-sm truncate ${
                          isTerminated ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {employee.team || 'No team'}
                        </p>
                      </div>

                      {/* View Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewProfile(employee._id);
                        }}
                        className={`mt-3 w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-sm rounded transition-colors font-medium ${
                          isTerminated 
                            ? 'bg-red-600 text-white hover:bg-red-700' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <DocumentTextIcon className="h-4 w-4" />
                        View Profile
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Teams Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Your teams
        </h2>

        {teamsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-14 w-14 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (filterBy === "Employees" ? null : teams.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No teams found
            </h3>
            <p className="text-gray-600 mb-4">
              Teams will appear here once they are created
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {(filterBy === "Employees" ? [] : filteredTeams.length > 0 ? filteredTeams : teams).map((team) => {
              const teamMembers = getTeamEmployees(team.name);
              return (
                <div
                  key={team._id}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-all hover:border-gray-300"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                      style={{ backgroundColor: team.color || '#3B82F6' }}
                    >
                      {team.initials || team.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {team.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {team.memberCount || 0} member{(team.memberCount || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleTeam(team.name)}
                      className="flex-1 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded transition-colors font-medium"
                    >
                      {expandedTeams[team.name] ? 'Hide Members' : 'View Members'}
                    </button>
                  </div>
                  {expandedTeams[team.name] && (
                    <div className="mt-4 pt-4 border-t border-gray-200 max-h-48 overflow-y-auto pr-1">
                      <div className="space-y-2">
                        {teamMembers.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-2">
                            No members assigned
                          </p>
                        ) : (
                          teamMembers.map((employee) => (
                            <div key={employee._id || employee.id} className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0">
                                {employee.profilePhoto ? (
                                  <img
                                    src={employee.profilePhoto}
                                    alt={`${employee.firstName} ${employee.lastName}`}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div
                                    className="h-full w-full flex items-center justify-center text-white font-medium text-sm"
                                    style={{ backgroundColor: employee.color || '#3B82F6' }}
                                  >
                                    {employee.initials || `${employee.firstName?.charAt(0) || ''}${employee.lastName?.charAt(0) || ''}`}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {employee.firstName} {employee.lastName}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {employee.jobTitle || '-'}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 animate-scaleIn">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-t-xl">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Confirm Deletion
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete <span className="font-bold text-red-600">{selectedEmployees.size}</span> employee(s)?
              </p>
              <p className="text-sm text-gray-600 mb-6">
                This action cannot be undone. All employee data will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
