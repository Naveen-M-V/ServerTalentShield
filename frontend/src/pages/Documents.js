import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Folder,
  ChevronRight,
  Calendar,
  User,
  FileText,
  Download,
  Filter,
  MoreVertical,
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';
import axios from 'axios';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { useAlert } from '../components/AlertNotification';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import CreateFolderModal from '../components/DocumentManagement/CreateFolderModal';

const Documents = () => {
  const navigate = useNavigate();
  const { error: showError, success: showSuccess } = useAlert();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(null);
  const [renameFolderOpen, setRenameFolderOpen] = useState(false);
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');

  // Fetch folders from API
  useEffect(() => {
    fetchFolders();
  }, [pagination.page, pagination.limit, sortBy, sortOrder]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.REACT_APP_API_URL || 'https://hrms.talentshield.co.uk';
      
      const response = await axios.get(`${apiUrl}/api/documentManagement/folders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          page: pagination.page,
          limit: pagination.limit,
          sort: sortBy,
          order: sortOrder
        }
      });
      
      setFolders(response.data.folders || []);
      setPagination(prev => ({ ...prev, total: response.data.total || 0 }));
    } catch (error) {
      console.error('Error fetching folders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folderId) => {
    navigate(`/documents/${folderId}`);
  };

  const handleRenameFolder = async (folder) => {
    setShowFolderMenu(null);
    setActiveFolder(folder);
    setRenameFolderValue(folder?.name || '');
    setRenameFolderOpen(true);
  };

  const handleDeleteFolder = async (folder) => {
    setShowFolderMenu(null);
    setActiveFolder(folder);
    setDeleteFolderOpen(true);
  };

  const submitRenameFolder = async () => {
    if (!activeFolder?._id) return;
    const nextName = String(renameFolderValue || '').trim();
    if (!nextName) return;

    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.REACT_APP_API_URL || 'https://hrms.talentshield.co.uk';
      await axios.put(
        `${apiUrl}/api/documentManagement/folders/${activeFolder._id}`,
        { name: nextName },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setRenameFolderOpen(false);
      setActiveFolder(null);
      showSuccess('Folder renamed successfully');
      fetchFolders();
    } catch (error) {
      console.error('Error renaming folder:', error);
      showError('Failed to rename folder');
    }
  };

  const confirmDeleteFolder = async () => {
    if (!activeFolder?._id) return;
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.REACT_APP_API_URL || 'https://hrms.talentshield.co.uk';
      await axios.delete(`${apiUrl}/api/documentManagement/folders/${activeFolder._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setDeleteFolderOpen(false);
      setActiveFolder(null);
      showSuccess('Folder deleted successfully');
      fetchFolders();
    } catch (error) {
      console.error('Error deleting folder:', error);
      showError('Failed to delete folder');
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // Implement search functionality
    fetchFolders();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter folders based on search
  const filteredFolders = folders.filter((folder) => {
    const query = String(searchQuery || '').toLowerCase();
    const name = String(folder?.name || folder?.fileName || '').toLowerCase();
    return name.includes(query);
  });

  const handleCreateReport = () => {
    // Navigate to report library page
    navigate('/report-library');
  };

  const handleFolderCreated = () => {
    setShowCreateFolderModal(false);
    fetchFolders();
  };

  const handlePaginationChange = (newLimit) => {
    setPagination(prev => ({ ...prev, limit: parseInt(newLimit), page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
          <p className="text-gray-600">All folders</p>
        </div>

        {/* Search and Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search all folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              {/* Pagination Dropdown */}
              <div className="w-40">
                <Select
                  value={String(pagination.limit)}
                  onValueChange={(value) => handlePaginationChange(value)}
                >
                  <SelectTrigger className="focus:ring-green-500">
                    <SelectValue placeholder="10 per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="25">25 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <button
                onClick={() => setShowCreateFolderModal(true)}
                className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Folder
              </button>

              {/* Create Report Button */}
              <button
                onClick={handleCreateReport}
                className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
              >
                Create report
              </button>
            </div>
          </div>
        </div>

        {/* Folders Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="bg-green-50 border-b border-gray-200">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-sm font-medium text-gray-700">
              <div className="col-span-5">Name</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-3">Date created</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : filteredFolders.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-gray-100 rounded-full">
                    <Folder className="w-12 h-12 text-gray-400" />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No folders found</h3>
                <p className="text-gray-500">Get started by creating your first folder</p>
              </div>
            ) : (
              filteredFolders.map((folder, index) => (
                <motion.div
                  key={folder._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="grid grid-cols-12 gap-4 px-6 py-3 hover:bg-gray-50 cursor-pointer transition-colors group"
                  onClick={() => handleFolderClick(folder._id)}
                >
                  {/* Name */}
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <Folder className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                        {folder.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {folder.documentCount || 0} document{folder.documentCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm text-gray-600">Folder</span>
                  </div>

                  {/* Size */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm text-gray-600">
                      {formatFileSize(folder.totalSize || 0)}
                    </span>
                  </div>

                  {/* Date Created */}
                  <div className="col-span-3 flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {formatDate(folder.createdAt)}
                    </span>
                    <div className="relative flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFolderMenu(showFolderMenu === folder._id ? null : folder._id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        aria-label="Folder actions"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />

                      <AnimatePresence>
                        {showFolderMenu === folder._id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleRenameFolder(folder)}
                              className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteFolder(folder)}
                              className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} folders
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm">
                  Page {pagination.page} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateFolderModal && (
        <CreateFolderModal
          onClose={() => setShowCreateFolderModal(false)}
          onCreate={handleFolderCreated}
          parentFolderId={null}
        />
      )}

      <AlertDialog open={renameFolderOpen} onOpenChange={setRenameFolderOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit folder name</AlertDialogTitle>
            <AlertDialogDescription>
              Update the folder name below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <input
              value={renameFolderValue}
              onChange={(e) => setRenameFolderValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Folder name"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setActiveFolder(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={submitRenameFolder}
              className="bg-green-600 hover:bg-green-700 focus-visible:ring-green-600"
              disabled={!String(renameFolderValue || '').trim()}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteFolderOpen} onOpenChange={setDeleteFolderOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the folder and all files/subfolders inside it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setActiveFolder(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteFolder}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Documents;
