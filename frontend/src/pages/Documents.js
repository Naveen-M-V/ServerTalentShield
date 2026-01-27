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
  Trash2,
  Upload,
  Eye
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
import DocumentViewer from '../components/DocumentManagement/DocumentViewer';
import { buildApiUrl } from '../utils/apiConfig';
import { useAuth } from '../context/AuthContext';

const Documents = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { error: showError, success: showSuccess } = useAlert();
  const { user } = useAuth();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [folderLoading, setFolderLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderContents, setFolderContents] = useState([]);
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
  
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);

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
    if (!folderId) {
      console.error('❌ No folder ID provided to handleFolderClick');
      showError('Cannot open folder: Invalid folder ID');
      return;
    }
    
    if (embedded) {
      setSelectedFolderId(folderId);
      return;
    }
    navigate(`/documents/${folderId}`);
  };

  const fetchFolderContents = async (folderId) => {
    try {
      setFolderLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(buildApiUrl(`/documentManagement/folders/${folderId}`), {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        withCredentials: true
      });

      setSelectedFolder(response.data.folder || null);
      setFolderContents(Array.isArray(response.data.contents) ? response.data.contents : []);
    } catch (error) {
      console.error('Error fetching folder contents:', error);
      showError('Failed to open folder');
      setSelectedFolder(null);
      setFolderContents([]);
    } finally {
      setFolderLoading(false);
    }
  };

  useEffect(() => {
    if (!embedded) return;
    if (!selectedFolderId) return;
    fetchFolderContents(selectedFolderId);
  }, [embedded, selectedFolderId]);

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

  const handleBackFromFolder = () => {
    setSelectedFolderId(null);
    setSelectedFolder(null);
    setFolderContents([]);
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

  // My Documents handlers
  const handleUploadToMyDocuments = () => {
    setUploadForm({ file: null, category: 'other', description: '' });
    setShowUploadModal(true);
  };

  const handleUploadSubmit = async () => {
    if (!uploadForm.file) {
      showError('Please select a file');
      return;
    }

    if (!myDocumentsFolder?._id) {
      showError('My Documents folder not found');
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem('auth_token');
      
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('category', uploadForm.category);
      formData.append('folderId', myDocumentsFolder._id);
      if (uploadForm.description) {
        formData.append('description', uploadForm.description);
      }

      await axios.post(
        buildApiUrl('/documentManagement/documents/upload'),
        formData,
        {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          withCredentials: true
        }
      );

      showSuccess('Document uploaded successfully!');
      setShowUploadModal(false);
      setUploadForm({ file: null, category: 'other', description: '' });
      
      // Refresh My Documents folder contents
      if (selectedFolderId === myDocumentsFolder._id) {
        fetchFolderContents(myDocumentsFolder._id);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      showError(error.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = (doc) => {
    setSelectedDocument(doc);
    setShowDocumentViewer(true);
  };

  const handleDownloadDocument = async (doc) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        buildApiUrl(`/documentManagement/documents/${doc._id}/download`),
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` })
          },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.name || doc.fileName || 'document');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      showError('Failed to download document');
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (embedded && selectedFolderId) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBackFromFolder}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Back
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedFolder?.name || 'Folder'}</h2>
              <p className="text-sm text-gray-500">{folderContents?.length || 0} items</p>
            </div>
          </div>
        </div>

        {folderLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <p className="text-sm text-gray-600 mt-2">Loading folder...</p>
          </div>
        ) : folderContents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents in this folder</h3>
            <p className="text-gray-600">This folder is currently empty.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {folderContents.map((item) => (
              <div key={item._id || item.id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{item.name || item.fileName || 'Document'}</div>
                    <div className="text-xs text-gray-500">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    type="button"
                    onClick={() => handleViewDocument(item)}
                    className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                    title="View document"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadDocument(item)}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Download document"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
          <p className="text-gray-600">Manage your personal documents and folders</p>
        </div>

        {/* My Documents Section */}
        {myDocumentsFolder && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Folder className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">My Documents</h2>
                  <p className="text-sm text-gray-600">Your personal document folder</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUploadToMyDocuments}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload Document
                </button>
                <button
                  onClick={() => handleFolderClick(myDocumentsFolder._id)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  View All
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Recent documents preview */}
            {selectedFolderId === myDocumentsFolder._id && folderContents.length > 0 && (
              <div className="mt-4 space-y-2">
                {folderContents.slice(0, 3).map((doc) => (
                  <div
                    key={doc._id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{doc.name || doc.fileName}</h4>
                        <p className="text-sm text-gray-500">
                          {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDocument(doc);
                        }}
                        className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                        title="View document"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadDocument(doc);
                        }}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Download document"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Folders</h2>
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
              filteredFolders.map((folder, index) => {
                // Validate folder has required fields
                if (!folder._id) {
                  console.error('❌ Folder missing _id:', folder);
                }
                
                return (
                  <motion.div
                    key={folder._id || index}
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
                            {(folder.canEdit ?? true) && (
                              <button
                                onClick={() => handleRenameFolder(folder)}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                                <span>Edit</span>
                              </button>
                            )}
                            {(folder.canDelete ?? true) && (
                              <button
                                onClick={() => handleDeleteFolder(folder)}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
              })
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

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Upload Document to My Documents</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                  className="w-full p-2 border rounded"
                >
                  <option value="other">Other</option>
                  <option value="contract">Contract</option>
                  <option value="certificate">Certificate</option>
                  <option value="identification">Identification</option>
                  <option value="training">Training</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className="w-full p-2 border rounded"
                  rows="3"
                  placeholder="Add a description..."
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadForm({ file: null, category: 'other', description: '' });
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={uploading || !uploadForm.file}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {showDocumentViewer && selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          onClose={() => {
            setShowDocumentViewer(false);
            setSelectedDocument(null);
          }}
          onDownload={handleDownloadDocument}
        />
      )}
    </div>
  );
};

export default Documents;
