import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Folder, Shield, Users, Eye, Edit, Trash2 } from 'lucide-react';
import axios from 'axios';
import '../../utils/axiosConfig';

const CreateFolderModal = ({ onClose, onCreate, parentFolderId }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: {
      view: ['admin', 'hr', 'manager', 'employee'],
      edit: ['admin', 'hr'],
      delete: ['admin']
    }
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const roles = ['admin', 'hr', 'manager', 'employee'];
  const permissionTypes = [
    { key: 'view', label: 'View Access', icon: Eye, color: 'green' },
    { key: 'edit', label: 'Edit Access', icon: Edit, color: 'blue' },
    { key: 'delete', label: 'Delete Access', icon: Trash2, color: 'red' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePermissionChange = (permissionType, role, isChecked) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permissionType]: isChecked
          ? [...prev.permissions[permissionType], role]
          : prev.permissions[permissionType].filter(r => r !== role)
      }
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Folder name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Folder name must be at least 2 characters';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Folder name cannot exceed 100 characters';
    }
    
    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description cannot exceed 500 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.REACT_APP_API_URL || 'https://hrms.talentshield.co.uk';
      
      const payload = {
        name: formData.name,
        description: formData.description,
        permissions: formData.permissions,
        parentFolderId: parentFolderId || null
      };

      const response = await axios.post(
        `${apiUrl}/api/documentManagement/folders`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      onCreate(response.data);
    } catch (error) {
      console.error('Error creating folder:', error);
      setErrors({ submit: 'Failed to create folder. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Animation variants
  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.9,
      transition: { duration: 0.2 }
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        type: 'spring', 
        stiffness: 300, 
        damping: 25,
        duration: 0.3
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9,
      transition: { duration: 0.2 }
    }
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  };

  return (
    <AnimatePresence>
      <motion.div
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Folder className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Create New Folder</h2>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 88px)' }}>
            {/* Folder Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Folder Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Employee Documents, Contracts, etc."
                autoFocus
                disabled={loading}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 resize-none ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Optional description of this folder..."
                disabled={loading}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            {/* Permissions */}
            <div className="mb-6">
              <div className="flex items-center space-x-2 mb-4">
                <Shield className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-medium text-gray-700">Folder Permissions</h3>
              </div>
              
              <div className="space-y-4">
                {permissionTypes.map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Icon className={`w-4 h-4 text-${color}-600`} />
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {roles.map((role) => (
                        <label key={role} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.permissions[key].includes(role)}
                            onChange={(e) => handlePermissionChange(key, role, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            disabled={loading}
                          />
                          <span className="text-sm text-gray-600 capitalize">{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreateFolderModal;
