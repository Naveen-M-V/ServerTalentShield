/**
 * API Configuration Utility
 * Handles API URL construction to avoid duplicate /api paths
 * Auto-detects environment: localhost uses localhost:5003, production uses hrms.talentshield.co.uk
 */

/**
 * Get the base API URL without /api suffix
 * @returns {string} Base URL (e.g., 'https://hrms.talentshield.co.uk' or 'http://localhost:5003')
 */
export const getApiBaseUrl = () => {
  // Check if we have an environment variable set
  if (process.env.REACT_APP_API_BASE_URL) {
    let baseUrl = process.env.REACT_APP_API_BASE_URL;
    baseUrl = baseUrl.replace(/\/$/, '');
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.slice(0, -4);
    }
    return baseUrl;
  }
  
  if (process.env.REACT_APP_API_URL) {
    let baseUrl = process.env.REACT_APP_API_URL;
    baseUrl = baseUrl.replace(/\/$/, '');
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.slice(0, -4);
    }
    return baseUrl;
  }
  
  // Auto-detect based on current hostname
  const hostname = window.location.hostname;
  
  // If running on localhost, use local backend
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5004';
  }
  
  // If running on production domain, use production backend
  if (hostname === 'hrms.talentshield.co.uk' || hostname === 'www.hrms.talentshield.co.uk') {
    return 'https://hrms.talentshield.co.uk';
  }
  
  // If no environment matches, throw error to alert developer
  console.error('⚠️ WARNING: Could not determine API base URL. Ensure REACT_APP_API_BASE_URL is set.');
  console.error('Current hostname:', hostname);
  return process.env.REACT_APP_API_BASE_URL || '';
};

/**
 * Build full API URL with path
 * @param {string} path - API path (e.g., '/certificates' or 'certificates')
 * @returns {string} Full API URL (e.g., 'https://hrms.talentshield.co.uk/api/certificates')
 */
export const buildApiUrl = (path) => {
  const baseUrl = getApiBaseUrl();
  
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // Build: baseUrl + /api + path
  return `${baseUrl}/api${cleanPath}`;
};

/**
 * Build API URL without /api prefix (for special endpoints)
 * @param {string} path - Path (e.g., '/health')
 * @returns {string} Full URL without /api
 */
export const buildDirectUrl = (path) => {
  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};

/**
 * Get image URL for profile pictures
 * @param {string} imagePath - Image path from profile.profilePicture
 * @returns {string} Full image URL
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  
  // If already a full URL, return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  const baseUrl = getApiBaseUrl();
  
  // Remove leading slash from imagePath if present
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  
  return `${baseUrl}/${cleanPath}`;
};

/**
 * Log current API configuration (for debugging)
 */
export const logApiConfig = () => {
  const baseUrl = getApiBaseUrl();
  console.log('🔧 API Configuration:');
  console.log('   Current hostname:', window.location.hostname);
  console.log('   API Base URL:', baseUrl);
  console.log('   Environment:', window.location.hostname === 'localhost' ? 'LOCAL DEV' : 'PRODUCTION');
};

// Log on initial load (can be removed in production)
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 API Config loaded');
  console.log('   Hostname:', window.location.hostname);
  console.log('   Will use API:', window.location.hostname === 'localhost' ? 'http://localhost:5004' : 'https://hrms.talentshield.co.uk');
}

// Export default object with all utilities
export default {
  getApiBaseUrl,
  buildApiUrl,
  buildDirectUrl,
  getImageUrl,
  logApiConfig
};
