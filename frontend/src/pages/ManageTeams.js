import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useAlert } from "../components/AlertNotification";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

export default function ManageTeams() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTeamName, setEditTeamName] = useState("");
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingTeamMembers, setEditingTeamMembers] = useState([]);
  const [editTeamLoading, setEditTeamLoading] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedTargetTeam, setSelectedTargetTeam] = useState('');

  // Employees data from API
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const { success: showSuccess, error: showError } = useAlert();

  // Teams data from API
  const [teams, setTeams] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    description: '',
    confirmText: 'Continue',
    cancelText: 'Cancel',
    variant: 'default',
    onConfirm: null,
  });

  // Fetch employees and teams from API
  useEffect(() => {
    fetchEmployees();
    fetchTeams();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/employees`);
      if (response.data.success) {
        // Transform API data to match component structure
        const transformedEmployees = response.data.data.map(emp => ({
          id: emp._id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          jobTitle: emp.jobTitle,
          department: emp.department,
          dateOfBirth: emp.dateOfBirth,
          currentTeam: emp.team || null
        }));
        console.log('Fetched employees:', transformedEmployees);
        setAllEmployees(transformedEmployees);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/teams`);
      if (response.data.success) {
        // Transform API data to match component structure
        const transformedTeams = response.data.data.map(team => ({
          id: team._id,
          name: team.name,
          initials: team.initials,
          memberCount: team.memberCount,
          color: team.color
        }));
        setTeams(transformedTeams);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const handleOpenAssignModal = () => {
    if (newTeamName.trim()) {
      console.log('Opening assign modal with employees:', allEmployees.length);
      setShowCreateModal(false);
      setShowAssignModal(true);
      // Initialize expanded groups
      const groups = {};
      teams.forEach(team => {
        groups[team.name] = true;
      });
      groups["No group"] = true; // Always expand "No group" section
      setExpandedGroups(groups);
      console.log('Initialized expanded groups:', groups);
    }
  };

  const toggleEmployeeSelection = (employeeId) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const toggleGroup = (groupName) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const renderEmployeeCard = (employee) => {
    const isSelectable = !employee.currentTeam;
    const isSelected = selectedEmployees.includes(employee.id);

    const baseClasses = "relative p-4 rounded-lg border-2 text-left transition-all";
    const selectableClasses = isSelected
      ? "border-blue-500 bg-blue-50"
      : "border-gray-200 hover:border-gray-300";
    const disabledClasses = "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed";

    return (
      <button
        key={employee.id}
        onClick={() => {
          if (!isSelectable) return;
          toggleEmployeeSelection(employee.id);
        }}
        disabled={!isSelectable}
        className={`${baseClasses} ${isSelectable ? selectableClasses : disabledClasses}`}
      >
        <div className="space-y-1">
          <div className="font-semibold text-gray-900">
            {employee.firstName} {employee.lastName}
          </div>
          <div className="text-sm text-gray-600">
            {employee.department || "-"}
          </div>
          <div className="text-sm text-gray-600">
            {employee.jobTitle || "-"}
          </div>
          <div className="text-sm text-gray-600">
            {formatDateOfBirth(employee.dateOfBirth)}
          </div>
          {!isSelectable && (
            <div className="text-xs text-gray-500 pt-1">
              Already in {employee.currentTeam}
            </div>
          )}
        </div>
        {isSelectable && isSelected && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </button>
    );
  };


  const handleCreateTeam = async () => {
    const trimmedName = newTeamName.trim();
    if (trimmedName) {
      try {
        // Generate initials from team name
        const words = trimmedName.split(" ");
        const initials = words.length > 1 
          ? words.map(w => w[0]).join("").toUpperCase()
          : trimmedName.substring(0, 2).toUpperCase();
        
        const teamData = {
          name: trimmedName,
          initials,
          members: selectedEmployees,
          color: "#3B82F6",
        };

        const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/teams`, teamData);
        
        if (response.data.success) {
          // Refresh teams and employees
          await fetchTeams();
          await fetchEmployees();
          
          // Reset states
          setNewTeamName("");
          setSelectedEmployees([]);
          setShowAssignModal(false);
          showSuccess('Team created successfully.');
        }
      } catch (error) {
        console.error('Error creating team:', error);
        const message = error.response?.data?.message || 'Failed to create team. Please try again.';
        showError(message);
      }
    }
  };

  const handleCloseModals = () => {
    setShowCreateModal(false);
    setShowAssignModal(false);
    setNewTeamName("");
    setSelectedEmployees([]);
  };

  const deleteTeamById = async (teamId) => {
    try {
      const response = await axios.delete(`${process.env.REACT_APP_API_BASE_URL}/teams/${teamId}`);
      if (response.data.success) {
        await fetchTeams();
        await fetchEmployees();
        showSuccess('Team deleted successfully.');
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      showError('Failed to delete team. Please try again.');
    }
  };

  const promptDeleteTeam = (teamId, teamName, onAfterDelete) => {
    setConfirmDialog({
      open: true,
      title: 'Delete team',
      description: `Delete ${teamName} and remove its member assignments? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: async () => {
        await deleteTeamById(teamId);
        onAfterDelete?.();
        setConfirmDialog((prev) => ({ ...prev, open: false }));
      }
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  };

  const loadEditingTeam = async (teamId) => {
    setEditTeamLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/teams/${teamId}`);
      if (response.data.success) {
        const teamData = response.data.data;
        setEditingTeam({
          id: teamData._id,
          name: teamData.name,
          initials: teamData.initials,
          color: teamData.color,
          memberCount: teamData.members?.length || 0,
          createdAt: teamData.createdAt,
        });
        setEditTeamName(teamData.name || "");
        setEditingTeamMembers(teamData.members || []);
      }
    } catch (error) {
      console.error('Error loading team details:', error);
      showError('Unable to load team details. Please try again.');
      setShowEditModal(false);
    } finally {
      setEditTeamLoading(false);
    }
  };

  const handleEditTeam = async (teamId) => {
    setShowEditModal(true);
    await loadEditingTeam(teamId);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingTeam(null);
    setEditingTeamMembers([]);
    setEditTeamName("");
  };

  const handleSaveEditedTeam = async () => {
    if (!editingTeam?.id) return;
    if (!editTeamName.trim()) {
      showError('Team name cannot be empty.');
      return;
    }

    try {
      await axios.put(`${process.env.REACT_APP_API_BASE_URL}/teams/${editingTeam.id}`, {
        name: editTeamName.trim(),
      });
      await fetchTeams();
      await loadEditingTeam(editingTeam.id);
      showSuccess('Team updated successfully.');
    } catch (error) {
      console.error('Error saving team:', error);
      showError('Failed to save changes. Please try again.');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!editingTeam?.id) return;
    setConfirmDialog({
      open: true,
      title: 'Remove member',
      description: 'Remove this employee from the team? They can be added to another team later.',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await axios.post(`${process.env.REACT_APP_API_BASE_URL}/teams/${editingTeam.id}/members/remove`, {
            employeeId: memberId,
          });
          await fetchEmployees();
          await fetchTeams();
          await loadEditingTeam(editingTeam.id);
        } catch (error) {
          console.error('Error removing member:', error);
          showError('Unable to remove member.');
        }
      }
    });
  };

  const handleSwitchMember = async (member) => {
    if (!editingTeam?.id) return;
    const otherTeams = teams.filter((team) => team.id !== editingTeam.id);
    if (otherTeams.length === 0) {
      showError('No other teams available to switch the member to.');
      return;
    }

    setSelectedMember(member);
    setSelectedTargetTeam(otherTeams[0].id);
    setSwitchDialogOpen(true);
  };

  const handleSwitchConfirm = async () => {
    if (!selectedMember || !selectedTargetTeam) return;
    
    const targetTeam = teams.find((team) => team.id === selectedTargetTeam);
    if (!targetTeam) {
      showError('Target team not found.');
      return;
    }

    try {
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/teams/${editingTeam.id}/members/remove`, {
        employeeId: selectedMember._id,
      });
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/teams/${targetTeam.id}/members/add`, {
        employeeId: selectedMember._id,
      });
      await fetchEmployees();
      await fetchTeams();
      await loadEditingTeam(editingTeam.id);
      showSuccess(`${selectedMember.firstName} ${selectedMember.lastName} moved to ${targetTeam.name}.`);
      setSwitchDialogOpen(false);
      setSelectedMember(null);
      setSelectedTargetTeam('');
    } catch (error) {
      console.error('Error switching member:', error);
      showError('Unable to switch member. Please try again.');
    }
  };

  const handleOpenAddMemberModal = async () => {
    try {
      // Get all employees and categorize them
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/employees`);
      if (response.data.success) {
        const employees = response.data.data;
        
        // Categorize employees by their team status
        const categorizedEmployees = employees.map(emp => {
          const isInOtherTeam = emp.team && emp.team !== editingTeam.name;
          const isInCurrentTeam = emp.team === editingTeam.name;
          const isAvailable = !emp.team || emp.team === '';
          
          return {
            id: emp._id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email,
            department: emp.department,
            jobTitle: emp.jobTitle,
            currentTeam: emp.team || null,
            isAvailable: isAvailable,
            isInCurrentTeam: isInCurrentTeam,
            isInOtherTeam: isInOtherTeam,
            status: isAvailable ? 'available' : (isInCurrentTeam ? 'current' : 'other-team')
          };
        });
        
        setAvailableEmployees(categorizedEmployees);
        setSelectedNewMembers([]);
        setShowAddMemberModal(true);
      }
    } catch (error) {
      console.error('Error fetching employees for add member:', error);
      showError('Unable to load employees. Please try again.');
    }
  };

  const toggleNewMemberSelection = (employeeId) => {
    setSelectedNewMembers(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedNewMembers.length === 0) {
      showError('Please select at least one employee to add.');
      return;
    }

    try {
      // Add each selected member to the team
      const addPromises = selectedNewMembers.map(employeeId => 
        axios.post(`${process.env.REACT_APP_API_BASE_URL}/teams/${editingTeam.id}/members/add`, {
          employeeId: employeeId,
        })
      );
      
      await Promise.all(addPromises);
      
      // Refresh data
      await fetchEmployees();
      await fetchTeams();
      await loadEditingTeam(editingTeam.id);
      
      setShowAddMemberModal(false);
      setSelectedNewMembers([]);
      showSuccess(`Added ${selectedNewMembers.length} member(s) to the team.`);
    } catch (error) {
      console.error('Error adding members:', error);
      showError('Unable to add members. Please try again.');
    }
  };

  // Helper function to format date of birth
  const formatDateOfBirth = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return "-";
    }
  };

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Page Title */}
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Team Management</h1>

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors mb-6"
        >
          Add a new team
        </button>

        {/* Search */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Find
          </label>
          <input
            type="text"
            placeholder="Team name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        {filteredTeams.map((team) => (
          <div
            key={team.id}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center justify-between">
              {/* Team Info */}
              <div className="flex items-center gap-3">
                <div
                  className="h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: team.color }}
                >
                  {team.initials}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {team.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEditTeam(team.id)}
                  className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Edit team"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => promptDeleteTeam(team.id, team.name)}
                  className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete team"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredTeams.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No teams found
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm
              ? "Try adjusting your search"
              : "Get started by creating your first team"}
          </p>
        </div>
      )}

      {/* Step 1: Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            {/* Modal Header */}
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
              <h2 className="text-xl font-bold">Add a new team</h2>
              <button
                onClick={handleCloseModals}
                className="text-white hover:text-gray-200"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Please enter a team name..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={handleCloseModals}
                  className="border-2 border-pink-600 text-pink-600 hover:bg-pink-50 px-6 py-2 rounded font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleOpenAssignModal}
                  disabled={!newTeamName.trim()}
                  className={`${
                    newTeamName.trim() 
                      ? "bg-green-600 hover:bg-green-700 text-white" 
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  } px-6 py-2 rounded font-medium transition-colors`}
                >
                  Select employees
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Assign Employees Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
              <h2 className="text-xl font-bold">Assign employees to "{newTeamName}"</h2>
              <button
                onClick={handleCloseModals}
                className="text-white hover:text-gray-200"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Debug info and loading state */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading employees...</span>
                </div>
              ) : allEmployees.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No employees found. Please check if employees are loaded.</p>
                </div>
              ) : (
                <>
                  {/* Group by existing teams */}
              {teams.map((team) => {
                const teamEmployees = allEmployees.filter((emp) => emp.currentTeam === team.name);
                if (teamEmployees.length === 0) return null;

                const teamSelectedCount = teamEmployees.filter((emp) =>
                  selectedEmployees.includes(emp.id)
                ).length;

                return (
                  <div key={team.name} className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleGroup(team.name)}
                          className="text-pink-600 hover:text-pink-700"
                        >
                          <svg
                            className={`h-6 w-6 transform transition-transform ${
                              expandedGroups[team.name] ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <span className="font-semibold text-gray-900">{team.name}</span>
                        <span className="bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded-full">
                          {teamSelectedCount}
                        </span>
                      </div>
                    </div>

                    {expandedGroups[team.name] && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teamEmployees.map((employee) => renderEmployeeCard(employee))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* No group section - Show all employees if no teams exist */}
              {(() => {
                const noGroupEmployees = teams.length === 0 
                  ? allEmployees 
                  : allEmployees.filter((emp) => !emp.currentTeam);
                
                console.log('No group employees:', noGroupEmployees);
                if (noGroupEmployees.length === 0) return null;

                const noGroupSelectedCount = noGroupEmployees.filter((emp) =>
                  selectedEmployees.includes(emp.id)
                ).length;

                return (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleGroup("No group")}
                          className="text-pink-600 hover:text-pink-700"
                        >
                          <svg
                            className={`h-6 w-6 transform transition-transform ${
                              expandedGroups["No group"] ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <span className="font-semibold text-gray-900">No group</span>
                        <span className="bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded-full">
                          {noGroupSelectedCount}
                        </span>
                      </div>
                    </div>

                    {expandedGroups["No group"] && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {noGroupEmployees.map((employee) => renderEmployeeCard(employee))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Fallback: Show all employees if no sections are visible */}
              {teams.length === 0 && allEmployees.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">All Employees</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allEmployees.map((employee) => renderEmployeeCard(employee))}
                  </div>
                </div>
              )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setShowCreateModal(true);
                }}
                className="border-2 border-pink-600 text-pink-600 hover:bg-pink-50 px-6 py-2 rounded font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateTeam}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-medium transition-colors"
              >
                Save ({selectedEmployees.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full">
            <div className="flex items-start gap-4 p-6 border-b border-gray-200">
              <div className="relative">
                <div
                  className="h-16 w-16 rounded-full flex items-center justify-center text-white text-2xl font-semibold"
                  style={{ backgroundColor: editingTeam?.color || '#3B82F6' }}
                >
                  {editingTeam?.initials || editingTeam?.name?.substring(0, 2)?.toUpperCase() || 'TM'}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{editingTeam?.name || 'Team'}</h2>
                    <p className="text-sm text-gray-500">{editingTeam?.memberCount || 0} member{(editingTeam?.memberCount || 0) === 1 ? '' : 's'}</p>
                  </div>
                  <button
                    onClick={handleCloseEditModal}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Close edit team modal"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {editingTeam?.createdAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Created on {new Date(editingTeam.createdAt).toLocaleDateString('en-GB')}
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Team name</label>
                <input
                  type="text"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter team name"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Team members</p>
                    <p className="text-xs text-gray-500">Manage existing members and move them between teams.</p>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-gray-500 uppercase tracking-wider text-xs">Name</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-500 uppercase tracking-wider text-xs">Department</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-500 uppercase tracking-wider text-xs">Email</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-500 uppercase tracking-wider text-xs">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {editTeamLoading ? (
                          <tr>
                            <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                              Loading team details...
                            </td>
                          </tr>
                        ) : editingTeamMembers.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                              No members in this team yet.
                            </td>
                          </tr>
                        ) : (
                          editingTeamMembers.map((member) => (
                            <tr key={member._id}>
                              <td className="px-4 py-3 text-gray-900 font-medium">
                                {member.firstName} {member.lastName}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {member.jobTitle || member.department || '-'}
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                {member.email || '-'}
                              </td>
                              <td className="px-4 py-3 text-right space-x-2">
                                <button
                                  onClick={() => handleSwitchMember(member)}
                                  className="px-3 py-1 text-xs font-medium rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100"
                                >
                                  Switch
                                </button>
                                <button
                                  onClick={() => handleRemoveMember(member._id)}
                                  className="px-3 py-1 text-xs font-medium rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleOpenAddMemberModal}
                  className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add member
                </button>
                <button
                  onClick={() => {
                    if (editingTeam?.id) {
                      promptDeleteTeam(editingTeam.id, editingTeam.name || 'team', handleCloseEditModal);
                    }
                  }}
                  className="text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete team
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCloseEditModal}
                  className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditedTeam}
                  disabled={editTeamLoading || !editingTeam}
                  className="px-5 py-2 rounded-lg bg-gray-900 text-white hover:bg-black text-sm font-semibold disabled:opacity-60"
                >
                  {editTeamLoading ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Add Members to {editingTeam?.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Select employees to add to this team. Employees already in teams are greyed out.
                </p>
              </div>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close add member modal"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-6 overflow-y-auto">
              {availableEmployees.length === 0 ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading employees...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Available Employees Section */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Available Employees</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {availableEmployees
                        .filter(emp => emp.status === 'available')
                        .map(employee => {
                          const isSelected = selectedNewMembers.includes(employee.id);
                          return (
                            <div
                              key={employee.id}
                              onClick={() => toggleNewMemberSelection(employee.id)}
                              className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="font-semibold text-gray-900">
                                  {employee.firstName} {employee.lastName}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {employee.department || "-"}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {employee.jobTitle || "-"}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {employee.email || "-"}
                                </div>
                                <div className="text-xs text-green-600 font-medium">
                                  Available
                                </div>
                              </div>
                              {isSelected && (
                                <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Employees in Other Teams Section */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Employees in Other Teams (Greyed Out)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {availableEmployees
                        .filter(emp => emp.status === 'other-team')
                        .map(employee => (
                          <div
                            key={employee.id}
                            className="relative p-4 rounded-lg border-2 border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                          >
                            <div className="space-y-2">
                              <div className="font-semibold text-gray-700">
                                {employee.firstName} {employee.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {employee.department || "-"}
                              </div>
                              <div className="text-sm text-gray-500">
                                {employee.jobTitle || "-"}
                              </div>
                              <div className="text-sm text-gray-400">
                                {employee.email || "-"}
                              </div>
                              <div className="text-xs text-orange-600 font-medium">
                                In {employee.currentTeam}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Current Team Members Section */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Team Members</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {availableEmployees
                        .filter(emp => emp.status === 'current')
                        .map(employee => (
                          <div
                            key={employee.id}
                            className="relative p-4 rounded-lg border-2 border-blue-200 bg-blue-50 cursor-not-allowed"
                          >
                            <div className="space-y-2">
                              <div className="font-semibold text-blue-900">
                                {employee.firstName} {employee.lastName}
                              </div>
                              <div className="text-sm text-blue-600">
                                {employee.department || "-"}
                              </div>
                              <div className="text-sm text-blue-600">
                                {employee.jobTitle || "-"}
                              </div>
                              <div className="text-sm text-blue-500">
                                {employee.email || "-"}
                              </div>
                              <div className="text-xs text-blue-600 font-medium">
                                Already in team
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50 rounded-b-2xl">
              <div className="text-sm text-gray-500">
                {selectedNewMembers.length} employee(s) selected
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMembers}
                  disabled={selectedNewMembers.length === 0}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold ${
                    selectedNewMembers.length > 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Add {selectedNewMembers.length} member(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) closeConfirmDialog();
        }}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
        onConfirm={async () => {
          await confirmDialog.onConfirm?.();
          closeConfirmDialog();
        }}
        onCancel={closeConfirmDialog}
      />

      {/* Switch Member Dialog */}
      <AlertDialog open={switchDialogOpen} onOpenChange={setSwitchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Move {selectedMember?.firstName} {selectedMember?.lastName} from "{editingTeam?.name}" to another team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Target Team
            </label>
            <Select value={selectedTargetTeam} onValueChange={setSelectedTargetTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.filter(team => team.id !== editingTeam?.id).map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSwitchConfirm}>
              Switch Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
