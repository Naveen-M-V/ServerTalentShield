// src/pages/Login.js
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ErrorBoundary from "../components/ErrorBoundary";
import { EyeIcon } from '@heroicons/react/24/outline';
import { EyeSlashIcon as EyeOffIcon } from '@heroicons/react/24/outline';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { EnvelopeIcon as MailIcon } from '@heroicons/react/24/outline';

export default function Login() {
  const [formData, setFormData] = useState({
    emailOrUsername: "",
    password: "",
    rememberMe: false
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationMessage, setVerificationMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading, error } = useAuth();
  
  // Load saved email if "remember me" was checked and fix loading issue
  useEffect(() => {
    let isMounted = true;
    
    const initializeComponent = () => {
      try {
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail && isMounted) {
          setFormData(prev => ({
            ...prev,
            emailOrUsername: savedEmail,
            rememberMe: true
          }));
        }

        // Check for verification success/error messages from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const verified = urlParams.get('verified');
        const error = urlParams.get('error');
        
        if (verified === 'true') {
          setVerificationMessage("Email verified successfully! You can now login to access your admin dashboard.");
        } else if (error === 'verification_failed') {
          setErrors({ general: "Email verification failed. Please try again or contact support." });
        }
      } catch (error) {
        console.error('Error loading saved email:', error);
      }
      
      // Fix loading issue by setting loading to false after component mounts
      if (isMounted) {
        setIsLoading(false);
      }
    };
    
    // Use requestAnimationFrame to ensure DOM is ready
    const timer = requestAnimationFrame(() => {
      initializeComponent();
    });
    
    return () => {
      isMounted = false;
      cancelAnimationFrame(timer);
    };
  }, []);

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
    
    if (!formData.emailOrUsername) {
      newErrors.emailOrUsername = "Username or email is required";
    } else if (formData.emailOrUsername.includes('@') && !/\S+@\S+\.\S+/.test(formData.emailOrUsername)) {
      newErrors.emailOrUsername = "Email is invalid";
    }
    
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
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
    setErrors({});
    
    try {
      const result = await login(formData.emailOrUsername, formData.password, formData.rememberMe);
      
      if (result.success) {
        // Handle remember me
        if (formData.rememberMe) {
          localStorage.setItem('rememberedEmail', formData.emailOrUsername);
        } else {
          localStorage.removeItem('rememberedEmail');
        }
        
        // Role-based routing with debug logging
        console.log('🔍 Login Debug - Full result:', result);
        console.log('🔍 Login Debug - User object:', result.user);
        console.log('🔍 Login Debug - User role:', result.user?.role);
        console.log('🔍 Login Debug - User type:', result.user?.userType);
        
        const userRole = result.user?.role || 'profile';
        const userType = result.user?.userType;
        let redirectPath;
        
        // Admin and Super-Admin → Admin Dashboard
        if (userRole === 'admin' || userRole === 'super-admin') {
          console.log('✅ Routing to: /dashboard (Admin)');
          redirectPath = location.state?.from?.pathname || "/dashboard";
        }
        // Employees (from EmployeeHub) → User Dashboard with clock in/out, shifts, documents
        else if (userRole === 'employee') {
          console.log('✅ Routing to: /user-dashboard (Employee)');
          redirectPath = "/user-dashboard";
        }
        // Profiles (interns, trainees) → User Dashboard
        else {
          console.log('✅ Routing to: /user-dashboard (Profile/Default)');
          redirectPath = "/user-dashboard";
        }
        
        console.log('🎯 Final redirect path:', redirectPath);
        navigate(redirectPath, { replace: true });
      } else {
        setErrors({ general: result.error || "Invalid email or password" });
      }
    } catch (error) {
      console.error("Login error:", error);
      setErrors({ 
        general: error.response?.data?.message || "An error occurred. Please try again." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading spinner to prevent blank page
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
        </div>
        
        <div className="max-w-md w-full space-y-8 relative z-10">
          {/* Header */}
          <div className="text-center animate-fade-in-up">
            <div className="mx-auto h-28 w-28 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center mb-4 shadow-lg border-4 border-white">
              <img 
                src="/TSL.png" 
                alt="TSL Logo" 
                className="h-20 w-20 object-contain drop-shadow-sm"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'block';
                }}
              />
              <svg className="h-10 w-10 text-emerald-600 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-gray-600">Sign in to access your HRMS dashboard</p>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-fade-in-up animation-delay-200">
            {/* Login Form */}
            <div className="bg-white/80 backdrop-blur-sm py-8 px-8 shadow-2xl rounded-2xl border border-white/50 hover:shadow-3xl transition-all duration-300">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {verificationMessage && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-400 p-4 rounded-lg shadow-sm animate-slide-in">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                        <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-emerald-800">{verificationMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              {(errors.general || error) && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 p-4 rounded-lg shadow-sm animate-shake">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">{errors.general || error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Username or Email */}
              
              <div className="space-y-1">
                <label htmlFor="emailOrUsername" className="block text-sm font-semibold text-gray-700 mb-2">
                  Username or Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MailIcon className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                  </div>
                  <input
                    id="emailOrUsername"
                    name="emailOrUsername"
                    type="text"
                    autoComplete="username"
                    value={formData.emailOrUsername}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    className={`block w-full pl-12 pr-4 py-3 border-2 ${
                      errors.emailOrUsername 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                        : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'
                    } rounded-xl placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 ease-in-out text-gray-900 bg-gray-50 hover:bg-white`}
                    placeholder="Enter your username or email"
                    aria-invalid={!!errors.emailOrUsername}
                    aria-describedby={errors.emailOrUsername ? 'emailOrUsername-error' : ''}
                  />
                  {errors.emailOrUsername && (
                    <p className="mt-2 text-sm text-red-600 flex items-center" id="emailOrUsername-error">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.emailOrUsername}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    className={`block w-full pl-12 pr-12 py-3 border-2 ${
                      errors.password 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                        : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-200'
                    } rounded-xl placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 ease-in-out text-gray-900 bg-gray-50 hover:bg-white`}
                    placeholder="Enter your password"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'password-error' : ''}
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    <button
                      type="button"
                      className="text-emerald-400 hover:text-emerald-600 focus:outline-none focus:text-emerald-600 transition-colors duration-200"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex="-1"
                    >
                      {showPassword ? (
                        <EyeOffIcon className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <EyeIcon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-600 flex items-center" id="password-error">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.password}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center">
                  <div className="relative">
                    <input
                      id="remember-me"
                      name="rememberMe"
                      type="checkbox"
                      checked={formData.rememberMe}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        rememberMe: e.target.checked
                      }))}
                      disabled={isSubmitting}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded transition-colors duration-200"
                    />
                  </div>
                  <label htmlFor="remember-me" className="ml-3 block text-sm font-medium text-gray-700 cursor-pointer">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <Link
                    to="/forgot-password"
                    className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors duration-200 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || isSubmitting}
                  aria-live="polite"
                  aria-busy={isSubmitting}
                  className={`w-full flex justify-center py-4 px-6 border border-transparent rounded-xl text-base font-semibold text-white transition-all duration-200 ease-in-out transform ${
                    loading || isSubmitting
                      ? 'bg-gray-400 cursor-not-allowed scale-95' 
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-emerald-200 hover:scale-105 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {loading || isSubmitting ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Sign in
                    </div>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/80 text-gray-600 font-medium">New Admin?</span>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex justify-center">
                  <Link
                    to="/signup"
                    state={{ from: location.state?.from }}
                    className="w-full max-w-xs flex justify-center py-3 px-6 border-2 border-emerald-500 rounded-xl text-sm font-semibold text-emerald-600 bg-white/50 backdrop-blur-sm hover:bg-emerald-50 hover:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200 transition-all duration-200 ease-in-out transform hover:scale-105 shadow-md hover:shadow-lg"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Admin Signup
                  </Link>
                </div>
                
                <div className="mt-6 text-center space-y-3">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    By signing in, you agree to our{' '}
                    <button 
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-emerald-600 hover:text-emerald-700 font-semibold underline bg-transparent border-none cursor-pointer transition-colors duration-200"
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button 
                      type="button"
                      onClick={() => setShowPrivacyModal(true)}
                      className="text-emerald-600 hover:text-emerald-700 font-semibold underline bg-transparent border-none cursor-pointer transition-colors duration-200"
                    >
                      Privacy Policy
                    </button>
                  </p>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    <p className="text-xs text-gray-600 font-medium">Powered by Vitrux Shield</p>
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse animation-delay-1000"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Terms and Conditions Modal */}
        {showTermsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Terms and Conditions</h3>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                  <h4 className="mb-4 font-bold text-gray-900">Terms and Conditions (T&Cs)</h4>
                  <p className="mb-2 text-sm text-gray-600"><strong>Effective Date:</strong> 06/10/2025</p>
                  <p className="mb-4">
                    Welcome to <strong>Talent Shield</strong> HRMS tool. By accessing and using this Application, you agree to comply with and be bound by these Terms & Conditions. If you do not agree, you should not use the <strong>Application</strong>.
                  </p>
                  
                  <h5 className="mb-3 font-bold text-gray-900">1. Definitions</h5>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li>"<strong>We</strong>", "<strong>Us</strong>", "<strong>Our</strong>" refer to <strong>Talent Shield</strong>, the owner and operator of this HRMS application.</li>
                    <li>"<strong>You</strong>", "<strong>User</strong>" refer to the individual or organisation using the Application.</li>
                    <li>"<strong>Application</strong>" refers to the HRMS system, its features, and associated services.</li>
                  </ul>
                  
                  <h5 className="mb-3 font-bold text-gray-900">2. Use of the Application</h5>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li>You agree to use the Application only for lawful HR and business purposes.</li>
                    <li>You must not use the Application in any way that violates applicable UK law, including but not limited to employment and data protection regulations.</li>
                    <li>Access credentials (such as usernames, passwords) must be kept confidential. You are responsible for all activities carried out under your account.</li>
                  </ul>
                  
                  <h5 className="mb-3 font-bold text-gray-900">3. Data Accuracy</h5>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li>Users are responsible for ensuring that all information entered into the Application is accurate and up to date.</li>
                    <li>We are not liable for errors or consequences resulting from incorrect or incomplete data entered by Users.</li>
                  </ul>
                  
                  <h5 className="mb-3 font-bold text-gray-900">4. Intellectual Property</h5>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li>All content, design, logos, and software associated with the Application remain the intellectual property of <strong>Vitrux Shield Ltd</strong> or its licensors.</li>
                    <li>Users are granted a limited, non-exclusive licence to use the Application for business purposes.</li>
                  </ul>
                  
                  <h5 className="mb-3 font-bold text-gray-900">5. Availability & Maintenance</h5>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li>We aim to provide continuous access to the Application but do not guarantee uninterrupted availability.</li>
                    <li>We may carry out scheduled maintenance or updates.</li>
                    <li>We are not liable for downtime, data loss, or interruptions beyond our reasonable control.</li>
                  </ul>
                  
                  <h5 className="mb-3 font-bold text-gray-900">6. Liability</h5>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li>The Application is provided on an "as-is" basis, without any warranties, whether express or implied.</li>
                    <li>We are not liable for indirect, incidental, or consequential damages arising from your use of the Application.</li>
                    <li>Nothing in these Terms excludes liability for death, personal injury, fraud, or any other liability which cannot be excluded under UK law.</li>
                  </ul>
                  
                  <h5 className="mb-3 font-bold text-gray-900">7. Termination</h5>
                  <p className="mb-4">
                    We reserve the right to suspend or terminate access to the Application if you breach these Terms.
                  </p>
                  
                  <h5 className="mb-3 font-bold text-gray-900">8. Governing Law</h5>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li>These Terms are governed by and construed in accordance with the laws of England and Wales.</li>
                    <li>Disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex justify-end p-6 border-t bg-gray-50">
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Privacy Policy Modal */}
        {showPrivacyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Privacy Policy</h3>
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                  <h4 className="mb-4 font-bold text-gray-900">Privacy Policy</h4>
                  <p className="mb-2 text-sm text-gray-600"><strong>Effective Date:</strong> 06/10/2025</p>
                  <p className="mb-4">
                    This Privacy Policy explains how <strong>Talent Shield</strong> ("we", "our", "us") collects, uses, and protects personal data within the HRMS application. We comply with the <strong>UK GDPR</strong> and the <strong>Data Protection Act 2018</strong>.
                  </p>
                  
                  <h5 className="mb-3 font-bold text-gray-900">1. Data We Collect</h5>
                  <p className="mb-2">We may collect and process the following categories of data:</p>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li><strong>Employee information</strong>: name, contact details, job title, payroll data, performance records.</li>
                    <li><strong>User account information</strong>: usernames, passwords, access logs.</li>
                    <li><strong>System usage data</strong>: device information, IP addresses, login times.</li>
                  </ul>
                  
                  <h5 className="mb-3 font-bold text-gray-900">2. How We Use Your Data</h5>
                  <p className="mb-2">We process personal data to:</p>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li>Provide HR management services through the Application.</li>
                    <li>Maintain payroll, leave, and performance records.</li>
                    <li>Ensure system security and prevent unauthorised access.</li>
                    <li>Comply with UK employment, taxation, and legal obligations.</li>
                  </ul>
                  
                  <h5 className="mb-3 font-bold text-gray-900">3. Legal Basis for Processing</h5>
                  <p className="mb-2">We process personal data under the following legal bases:</p>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li><strong>Contractual necessity</strong> – to deliver HRMS services.</li>
                    <li><strong>Legal obligations</strong> – to comply with UK law.</li>
                    <li><strong>Legitimate interests</strong> – for system improvement and security.</li>
                    <li><strong>Consent</strong> – where explicitly required.</li>
                  </ul>
                  
                  <h5 className="mb-3 font-bold text-gray-900">4. Data Sharing & Transfers</h5>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li>Data is stored on servers located in the <strong>United Kingdom</strong>.</li>
                    <li>We do not transfer personal data outside the UK unless adequate safeguards are in place.</li>
                    <li>We may share data with authorised third parties (e.g., payroll providers, IT support) under strict confidentiality agreements.</li>
                  </ul>
                  
                  <h5 className="mb-3 font-bold text-gray-900">5. Data Retention</h5>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li>Personal data is retained only for as long as necessary to fulfil contractual and legal obligations.</li>
                    <li>After this period, data will be securely deleted or anonymised.</li>
                  </ul>
                  
                  <h5 className="mb-3 font-bold text-gray-900">6. Your Rights</h5>
                  <p className="mb-2">Under the UK GDPR, you have the right to:</p>
                  <ul className="mb-4 list-disc pl-5 space-y-1">
                    <li>Access your personal data.</li>
                    <li>Correct inaccurate data.</li>
                    <li>Request erasure (right to be forgotten).</li>
                    <li>Restrict or object to processing.</li>
                    <li>Request data portability.</li>
                    <li>Withdraw consent (where applicable).</li>
                    <li>Lodge a complaint with the <strong>Information Commissioner's Office (ICO)</strong>.</li>
                  </ul>
                  
                  <h5 className="mb-3 font-bold text-gray-900">7. Security</h5>
                  <p className="mb-4">
                    We implement technical and organisational measures (e.g., encryption, access controls) to protect personal data from unauthorised access, loss, or misuse.
                  </p>
                  
                  <h5 className="mb-3 font-bold text-gray-900">8. Updates to this Policy</h5>
                  <p className="mb-4">
                    We may update this Privacy Policy to reflect changes in law or application functionality. Updates will be communicated to users.
                  </p>
                  
                  <h5 className="mb-3 font-bold text-gray-900">9. Contact Us</h5>
                  <p className="mb-2">If you have questions about this Privacy Policy or your data rights, contact us at:</p>
                  <p className="mb-1"><strong>Vitrux Shield Ltd</strong></p>
                  <p className="mb-1"><strong>1-7, Park Road, Caterham, England, CR3 5TB</strong></p>
                  <p className="mb-1">Email: <a href="mailto:IT@vitrux.co.uk" className="text-emerald-600 hover:text-emerald-700 underline"><strong>IT@vitrux.co.uk</strong></a></p>
                  <p className="mb-4">Phone: <strong>07459734663</strong></p>
                </div>
              </div>
              
              <div className="flex justify-end p-6 border-t bg-gray-50">
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}
