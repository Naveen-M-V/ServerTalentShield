// API Configuration utility
const getApiBaseUrl = () => {
  // Force localhost in development mode
  if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
    return 'http://localhost:5004/api';
  }
  return process.env.REACT_APP_API_BASE_URL || 
         process.env.REACT_APP_API_URL || 
         'https://hrms.talentshield.co.uk/api';
};

const getServerBaseUrl = () => {
  // Force localhost in development mode
  if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
    return 'http://localhost:5004';
  }
  return process.env.REACT_APP_SERVER_BASE_URL || 
         process.env.REACT_APP_API_BASE_URL?.replace('/api', '') || 
         process.env.REACT_APP_API_URL?.replace('/api', '') || 
         'https://hrms.talentshield.co.uk';
};

export const API_BASE_URL = getApiBaseUrl();
export const SERVER_BASE_URL = getServerBaseUrl();

// Helper function to get full image URL (works for PDFs and other files too)
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If the path already starts with http/https, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // If the path starts with /uploads, use it directly
  if (imagePath.startsWith('/uploads/')) {
    return `${SERVER_BASE_URL}${imagePath}`;
  }
  
  // If the path doesn't start with /, add /uploads/ prefix
  if (!imagePath.startsWith('/')) {
    return `${SERVER_BASE_URL}/uploads/${imagePath}`;
  }
  
  // Default case - use the path as provided
  return `${SERVER_BASE_URL}${imagePath}`;
};
