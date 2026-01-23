import React, { useState } from 'react';
import { UserPlusIcon, EnvelopeIcon as MailIcon, UserIcon, IdentificationIcon } from '@heroicons/react/24/outline';
import { buildApiUrl } from '../utils/apiConfig';

const CreateUser = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    vtid: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch(buildApiUrl('/users/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `User created successfully! Login credentials have been sent to ${formData.email}` 
        });
        // Reset form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          vtid: ''
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: data.message || 'Failed to create user' 
        });
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setMessage({ 
        type: 'error', 
        text: 'An error occurred. Please try again.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
            <UserPlusIcon className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Create New User
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Add a new user to the HRMS system
          </p>
          <p className="mt-1 text-xs text-emerald-600 font-medium">
            Login credentials will be sent via email
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white/70 backdrop-blur-sm shadow-2xl rounded-2xl p-8 border border-white/20">
          {/* Success/Error Message */}
          {message.text && (
            <div className={`mb-6 p-4 rounded-xl border-l-4 ${
              message.type === 'success' 
                ? 'bg-emerald-50 border-emerald-400 text-emerald-700' 
                : 'bg-red-50 border-red-400 text-red-700'
            }`}>
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-3 border-2 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 hover:bg-white ${
                      errors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="Enter first name"
                  />
                </div>
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-3 border-2 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 hover:bg-white ${
                      errors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
                    }`}
                    placeholder="Enter last name"
                  />
                </div>
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MailIcon className="h-5 w-5 text-emerald-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`block w-full pl-10 pr-3 py-3 border-2 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 hover:bg-white ${
                    errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
                  }`}
                  placeholder="Enter email address"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* VTID Field (Optional) */}
            <div>
              <label htmlFor="vtid" className="block text-sm font-medium text-gray-700 mb-2">
                VTID (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IdentificationIcon className="h-5 w-5 text-emerald-400" />
                </div>
                <input
                  id="vtid"
                  name="vtid"
                  type="text"
                  value={formData.vtid}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-gray-50 hover:bg-white"
                  placeholder="Auto-generated if not provided"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Leave empty to auto-generate a unique VTID
              </p>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-105 shadow-lg"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating User...
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="h-5 w-5 mr-2" />
                    Create User & Send Credentials
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
            <div className="flex">
              <div className="flex-shrink-0">
                <MailIcon className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-emerald-800">
                  Automatic Email Delivery
                </h3>
                <div className="mt-2 text-sm text-emerald-700">
                  <p>
                    A secure password (minimum 6 characters) will be generated and sent to the user's email address along with login instructions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateUser;
