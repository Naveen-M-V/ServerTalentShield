import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { CheckIcon, ArrowLeftIcon } from "@heroicons/react/24/solid";
import { DatePicker } from "../components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useAlert } from "../components/AlertNotification";
import { buildApiUrl } from "../utils/apiConfig";
import { 
  validateDateOfBirth, 
  getMaxDOBDate, 
  handleMobileNumberChange, 
  preventNonMobileNumeric, 
  validateStartDate, 
  validateProbationEndDate, 
  getMaxStartDate, 
  getMinProbationDate,
  validateFieldCharacters,
  collectCharacterErrors,
  validateImageFile,
  validateDocumentFile
} from "../utils/inputValidation";

dayjs.extend(customParseFormat);

export default function AddEmployee() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Edit mode management
  const editEmployeeId = searchParams.get('edit');
  const isEditMode = Boolean(editEmployeeId);

  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  // Employees list for manager dropdown
  const [employees, setEmployees] = useState([]);

  // Teams data from API
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // Form data state
  const [formData, setFormData] = useState({
    // Basic details
    title: "",
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "Unspecified",
    ethnicity: "Unspecified",
    dateOfBirth: "",
    emailAddress: "",
    mobileNumber: "",
    workPhone: "",
    jobTitle: "",
    department: "",
    team: "",
    office: "",
    managerId: "",
    OrganisationName: "",
    employmentStartDate: "",
    probationEndDate: "",
    // Profile photo
    profilePhoto: "",
    // Address details
    address1: "",
    address2: "",
    address3: "",
    townCity: "",
    county: "",
    postcode: "",
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",
    emergencyContactEmail: "",
    leaveEntitlement: "",
    leaveAllowance: "",
    // Salary details
    salary: "0",
    rate: "",
    paymentFrequency: "",
    effectiveFrom: "",
    reason: "",
    payrollNumber: "",
    // Bank details
    accountName: "",
    bankName: "",
    bankBranch: "",
    accountNumber: "",
    sortCode: "",
    // Sensitive details
    taxCode: "",
    niNumber: "",
    // Passport
    passportNumber: "",
    passportCountry: "",
    passportExpiryDate: "",
    // Driving licence
    licenceNumber: "",
    licenceCountry: "",
    licenceClass: "",
    licenceExpiryDate: "",
    // Visa
    visaNumber: "",
    visaExpiryDate: "",
    documents: [],
  });

  const [errors, setErrors] = useState({});
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const { success: showSuccess, error: showError } = useAlert();

  // Image editing states
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageZoom, setImageZoom] = useState(1);

  // Step definitions
  const steps = [
    { id: 1, name: "Basic Details", description: "Personal information" },
    { id: 2, name: "Address Details", description: "Home address" },
    { id: 3, name: "Emergency Contact", description: "Emergency contact info" },
    { id: 4, name: "Leave Entitlement", description: "Optional leave settings" },
    { id: 5, name: "Account & Pay Details", description: "Salary and bank info" },
    { id: 6, name: "Sensitive Details", description: "Tax and document info" }
  ];

  const fieldId = (field) => `add-employee-field-${field}`;
  const focusFirstErrorField = (fields) => {
    if (!fields || fields.length === 0 || typeof document === 'undefined') return;
    const target = document.getElementById(fieldId(fields[0]));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    }
  };

  const getInputClass = (field) => {
    const baseClass = "w-full h-[42px] px-4 py-2.5 border rounded-lg transition-colors focus:outline-none";
    const hasError = Boolean(errors[field]);
    const errorClass = hasError
      ? "border-pink-500 focus:ring-pink-300 ring-1 ring-pink-200"
      : "border-gray-300 focus:ring-2 focus:ring-blue-500";
    return `${baseClass} ${errorClass}`;
  };

  const handleInputChange = (field, value) => {
    const validationMessage = validateFieldCharacters(field, value);
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (validationMessage) {
      setErrors((prev) => ({ ...prev, [field]: validationMessage }));
      showError('validation error');
    } else if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }

    // Special validation for Date of Birth
    if (field === "dateOfBirth" && value) {
      const validation = validateDateOfBirth(value);
      if (!validation.isValid) {
        setErrors((prev) => ({ ...prev, [field]: validation.message }));
        showError('validation error');
      } else if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: "" }));
      }
    }

    // Special validation for Employment Start Date
    if (field === "employmentStartDate" && value) {
      const validation = validateStartDate(value);
      if (!validation.isValid) {
        setErrors((prev) => ({ ...prev, [field]: validation.message }));
        showError('validation error');
      } else if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: "" }));
      }
    }

    // Special validation for Probation End Date
    if (field === "probationEndDate" && value) {
      const validation = validateProbationEndDate(value);
      if (!validation.isValid) {
        setErrors((prev) => ({ ...prev, [field]: validation.message }));
        showError('validation error');
      } else if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: "" }));
      }
    }

    if (field === "emailAddress" && emailError) {
      setEmailError("");
    }

    // Real-time email validation
    if (field === "emailAddress" && value) {
      if (!validateEmail(value)) {
        setEmailError("Please enter a valid email address.");
      } else if (emailError) {
        setEmailError("");
      }
    }
  };

  // Fetch employee data for edit mode
  const fetchEmployeeData = async (employeeId) => {
    // Validate MongoDB ObjectId format (24 hex characters)
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!objectIdPattern.test(employeeId)) {
      console.warn('Invalid employee ID format:', employeeId);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/employees/${employeeId}`);

      if (response.data.success) {
        const employee = response.data.data;

        // Helper function to format dates for display (YYYY-MM-DD → DD/MM/YYYY)
        const formatDateForDisplay = (dateStr) => {
          if (!dateStr) return "";
          const date = dayjs(dateStr);
          return date.isValid() ? date.format("DD/MM/YYYY") : "";
        };

        // Update form data with employee information
        setFormData({
          title: employee.title || "",
          firstName: employee.firstName || "",
          middleName: employee.middleName || "",
          lastName: employee.lastName || "",
          gender: employee.gender || "Unspecified",
          ethnicity: employee.ethnicity || "Unspecified",
          dateOfBirth: formatDateForDisplay(employee.dateOfBirth),
          emailAddress: employee.email || "",
          mobileNumber: employee.phone || "",
          workPhone: employee.workPhone || "",
          profilePhoto: employee.profilePhoto || "",
          jobTitle: employee.jobTitle || "",
          department: employee.department || "",
          team: employee.team || "",
          OrganisationName: employee.OrganisationName || employee.office || "",
          employmentStartDate: formatDateForDisplay(employee.startDate),
          probationEndDate: formatDateForDisplay(employee.probationEndDate),
          address1: employee.address1 || "",
          address2: employee.address2 || "",
          address3: employee.address3 || "",
          townCity: employee.townCity || "",
          county: employee.county || "",
          postcode: employee.postcode || "",
          emergencyContactName: employee.emergencyContactName || "",
          emergencyContactRelation: employee.emergencyContactRelation || "",
          emergencyContactPhone: employee.emergencyContactPhone || "",
          emergencyContactEmail: employee.emergencyContactEmail || "",
          leaveEntitlement: employee.leaveEntitlement !== undefined && employee.leaveEntitlement !== null ? employee.leaveEntitlement.toString() : "",
          leaveAllowance: employee.leaveAllowance !== undefined && employee.leaveAllowance !== null ? employee.leaveAllowance.toString() : "",
          salary: employee.salary || "0",
          rate: employee.rate || "",
          paymentFrequency: employee.paymentFrequency || "",
          effectiveFrom: formatDateForDisplay(employee.effectiveFrom),
          reason: employee.reason || "",
          payrollNumber: employee.payrollNumber || "",
          accountName: employee.accountName || "",
          bankName: employee.bankName || "",
          bankBranch: employee.bankBranch || "",
          accountNumber: employee.accountNumber || "",
          sortCode: employee.sortCode || "",
          taxCode: employee.taxCode || "",
          niNumber: employee.niNumber || "",
          passportNumber: employee.passportNumber || "",
          passportCountry: employee.passportCountry || "",
          passportExpiryDate: formatDateForDisplay(employee.passportExpiryDate),
          licenceNumber: employee.licenceNumber || "",
          licenceCountry: employee.licenceCountry || "",
          licenceClass: employee.licenceClass || "",
          licenceExpiryDate: formatDateForDisplay(employee.licenceExpiryDate),
          visaNumber: employee.visaNumber || "",
          visaExpiryDate: formatDateForDisplay(employee.visaExpiryDate),
          documents: employee.documents || [],
        });
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
      showError('Failed to load employee data. Please try again.');
      navigate('/employee-hub');
    } finally {
      setLoading(false);
    }
  };

  // Load employee data when in edit mode
  // Fetch employees for manager dropdown
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/employees`);
        if (response.data?.data) {
          setEmployees(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
      }
    };

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
    
    fetchEmployees();
    fetchTeams();
  }, []);

  useEffect(() => {
    if (isEditMode && editEmployeeId) {
      fetchEmployeeData(editEmployeeId);
    }
  }, [isEditMode, editEmployeeId]);

  // Step navigation functions
  const goToStep = (stepNumber) => {
    if (stepNumber >= 1 && stepNumber <= totalSteps) {
      // Only allow navigation to previous steps or current step without validation
      // For future steps, validate current step first
      if (stepNumber > currentStep) {
        if (validateCurrentStep()) {
          setCurrentStep(stepNumber);
        }
      } else {
        setCurrentStep(stepNumber);
      }
    }
  };

  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Validation for current step
  const validateCurrentStep = () => {
    const newErrors = {};

    if (currentStep === 1) {
      // Basic Details validation - mandatory fields
      if (!formData.firstName) newErrors.firstName = "Required";
      if (!formData.lastName) newErrors.lastName = "Required";
      if (!formData.emailAddress) {
        newErrors.emailAddress = "Required";
        setEmailError("Please provide a valid email address.");
      } else if (!validateEmail(formData.emailAddress)) {
        newErrors.emailAddress = "Invalid";
        setEmailError("Please provide a valid email address.");
      }
      if (!formData.mobileNumber) newErrors.mobileNumber = "Required";
      if (!formData.jobTitle) newErrors.jobTitle = "Required";
      if (!formData.department) newErrors.department = "Required";
      if (!formData.OrganisationName) newErrors.OrganisationName = "Required";
      
      // Employment Start Date validation
      if (!formData.employmentStartDate) {
        newErrors.employmentStartDate = "Required";
      } else {
        const parsedDate = dayjs(formData.employmentStartDate, "DD/MM/YYYY", true);
        if (!parsedDate.isValid()) {
          newErrors.employmentStartDate = "Invalid date format. Please use DD/MM/YYYY";
        } else {
          // Additional validation for future dates
          const validation = validateStartDate(formData.employmentStartDate);
          if (!validation.isValid) {
            newErrors.employmentStartDate = validation.message;
          }
        }
      }
      
      // Probation End Date validation
      if (!formData.probationEndDate) {
        newErrors.probationEndDate = "Required";
      } else {
        const parsedDate = dayjs(formData.probationEndDate, "DD/MM/YYYY", true);
        if (!parsedDate.isValid()) {
          newErrors.probationEndDate = "Invalid date format. Please use DD/MM/YYYY";
        } else {
          // Additional validation for past dates
          const validation = validateProbationEndDate(formData.probationEndDate);
          if (!validation.isValid) {
            newErrors.probationEndDate = validation.message;
          }
        }
      }
    }
    // Steps 2, 3, 4, 5, 6 have no required fields, so they can be skipped

    const characterErrors = collectCharacterErrors(formData);
    Object.entries(characterErrors).forEach(([field, message]) => {
      if (!newErrors[field]) {
        newErrors[field] = message;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      focusFirstErrorField(Object.keys(newErrors));
      return false;
    }

    setErrors({});
    return true;
  };

  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleSaveEmployee = async () => {
    // Final validation before saving
    if (!validateCurrentStep()) {
      return;
    }

    // Save to EmployeeHub schema
    setLoading(true);

    try {
      // Convert start date format (DD/MM/YYYY → YYYY-MM-DD)
      let formattedStartDate;

      // Check if the date is valid before formatting
      const parsedDate = dayjs(formData.employmentStartDate, "DD/MM/YYYY", true);
      if (!parsedDate.isValid()) {
        throw new Error("Invalid date format. Please use DD/MM/YYYY format.");
      }

      formattedStartDate = parsedDate.format("YYYY-MM-DD");

      // Helper function to format dates from DD/MM/YYYY to YYYY-MM-DD
      const formatDateField = (dateStr) => {
        if (!dateStr) return null;

        // If already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          return dateStr;
        }

        // Try to parse DD/MM/YYYY format
        const parsed = dayjs(dateStr, "DD/MM/YYYY", true);
        if (parsed.isValid()) {
          return parsed.format("YYYY-MM-DD");
        }

        // Try standard date parsing as fallback
        const standardParsed = dayjs(dateStr);
        if (standardParsed.isValid()) {
          return standardParsed.format("YYYY-MM-DD");
        }
        
        return null;
      };

      // Prepare employee data
      const employeeData = {
        title: formData.title,
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        gender: formData.gender,
        ethnicity: formData.ethnicity,
        dateOfBirth: formatDateField(formData.dateOfBirth),
        email: formData.emailAddress, // Map emailAddress to email for backend
        phone: formData.mobileNumber, // Map mobileNumber to phone for backend
        workPhone: formData.workPhone,
        jobTitle: formData.jobTitle,
        department: formData.department,
        team: formData.team || "",
        office: formData.office,
        managerId: formData.managerId || null,
        OrganisationName: formData.OrganisationName,
        startDate: formattedStartDate, // Map employmentStartDate to startDate for backend
        probationEndDate: formData.probationEndDate ? formatDateField(formData.probationEndDate) : null,
        profilePhoto: formData.profilePhoto,
        address1: formData.address1,
        address2: formData.address2,
        address3: formData.address3,
        townCity: formData.townCity,
        county: formData.county,
        postcode: formData.postcode,
        // Emergency contact - send as flat fields, backend will transform
        emergencyContactName: formData.emergencyContactName,
        emergencyContactRelation: formData.emergencyContactRelation,
        emergencyContactPhone: formData.emergencyContactPhone,
        emergencyContactEmail: formData.emergencyContactEmail,
        leaveEntitlement: formData.leaveEntitlement !== '' ? Number(formData.leaveEntitlement) : null,
        leaveAllowance: formData.leaveAllowance !== '' ? Number(formData.leaveAllowance) : null,
        salary: formData.salary,
        rate: formData.rate,
        paymentFrequency: formData.paymentFrequency,
        effectiveFrom: formData.effectiveFrom,
        reason: formData.reason,
        payrollNumber: formData.payrollNumber,
        // Bank details - send as flat fields
        accountName: formData.accountName,
        bankName: formData.bankName,
        bankBranch: formData.bankBranch,
        accountNumber: formData.accountNumber,
        sortCode: formData.sortCode,
        taxCode: formData.taxCode,
        niNumber: formData.niNumber,
        passportNumber: formData.passportNumber,
        passportCountry: formData.passportCountry,
        passportExpiryDate: formData.passportExpiryDate ? formatDateField(formData.passportExpiryDate) : null,
        licenceNumber: formData.licenceNumber,
        licenceCountry: formData.licenceCountry,
        licenceClass: formData.licenceClass,
        licenceExpiryDate: formData.licenceExpiryDate ? formatDateField(formData.licenceExpiryDate) : null,
        visaNumber: formData.visaNumber,
        visaExpiryDate: formData.visaExpiryDate ? formatDateField(formData.visaExpiryDate) : null
        // NOTE: Do NOT send documents here - they need separate uploads via DocumentManagement API
      };

      // Log the data being sent for debugging
      console.log('📤 Sending employee data:', JSON.stringify(employeeData, null, 2));
      
      let response;
      let createdEmployeeId;
      
      if (isEditMode) {
        response = await axios.put(
          `${process.env.REACT_APP_API_BASE_URL}/employees/${editEmployeeId}`,
          employeeData
        );
        createdEmployeeId = editEmployeeId;
      } else {
        response = await axios.post(
          `${process.env.REACT_APP_API_BASE_URL}/employees`,
          employeeData
        );
        createdEmployeeId = response?.data?.data?.id;
      }

      const succeeded = response?.data?.success ?? (response?.status >= 200 && response?.status < 300);
      if (!succeeded) {
        throw new Error(response?.data?.message || 'Employee creation was rejected by the server.');
      }

      // 📂 NEW: Upload documents AFTER employee is created
      if (formData.documents && formData.documents.length > 0 && createdEmployeeId) {
        try {
          console.log('📂 Uploading documents for employee:', createdEmployeeId);
          console.log('📂 Number of documents to upload:', formData.documents.length);

          // Upload each document
          for (const docFile of formData.documents) {
            // Only upload if it's an actual File object (not just metadata from previous load)
            if (docFile instanceof File) {
              const formDataObj = new FormData();
              formDataObj.append('file', docFile);
              formDataObj.append('category', 'employee-document');
              formDataObj.append('ownerId', createdEmployeeId);
              
              try {
                const uploadResponse = await axios.post(
                  buildApiUrl('/documentManagement/documents'),
                  formDataObj,
                  {
                    headers: {
                      'Content-Type': 'multipart/form-data'
                    }
                  }
                );
                console.log('✅ Document uploaded successfully:', docFile.name);
              } catch (docUploadError) {
                console.warn('⚠️ Document upload failed (non-blocking):', docFile.name, docUploadError);
                // Don't fail the entire operation if one document fails
              }
            }
          }
        } catch (docError) {
          console.warn('⚠️ Document upload process failed (non-blocking):', docError);
          // Don't fail the entire operation if document upload fails
        }
      }

      showSuccess(isEditMode ? "Employee updated successfully!" : "Employee created successfully!");
      navigate("/employee-hub?refresh=" + Date.now());
    } catch (error) {
      // Enhanced error logging
      console.error('❌ Employee save failed:', error);
      console.error('📋 Error response:', error.response?.data);
      console.error('📋 Error status:', error.response?.status);
      console.error('📋 Error message:', error.response?.data?.message);
      console.error('📋 Validation errors:', error.response?.data?.errors);
      
      // Build detailed error message
      let message = error.response?.data?.message || error.message || "Failed to save employee. Please try again.";
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorDetails = error.response.data.errors.map(err => err.message || err).join(', ');
        message = `${message}: ${errorDetails}`;
      }
      
      showError(`Failed to save employee: ${message}`);
    } finally {
      setLoading(false);
    }
  };

    const handleBack = () => {
      if (isEditMode) {
        // For edit mode, redirect to employee hub with a flag to open the profile modal
        navigate(`/employee-hub?viewProfile=${editEmployeeId}`);
      } else {
        // For add mode, simply go back to employee hub
        navigate("/employee-hub");
      }
    };

    const handleCancel = () => {
      navigate("/employee-hub");
    };

    // Render step indicator
    const renderStepIndicator = () => {
      return (
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isCompleted = step.id < currentStep;
              const isCurrent = step.id === currentStep;
              const isClickable = step.id <= currentStep;

              return (
                <div key={step.id} className="flex items-center">
                  {/* Step Circle */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => isClickable && goToStep(step.id)}
                      disabled={!isClickable}
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${isCompleted
                        ? "bg-purple-600 text-white hover:bg-purple-700"
                        : isCurrent
                          ? "bg-purple-600 text-white"
                          : isClickable
                            ? "bg-gray-200 text-gray-600 hover:bg-gray-300 cursor-pointer"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                    >
                      {isCompleted ? (
                        <CheckIcon className="w-5 h-5" />
                      ) : (
                        step.id
                      )}
                    </button>
                    <div className="mt-2 text-center">
                      <div className={`text-sm font-medium ${isCurrent ? "text-purple-600" : "text-gray-600"
                        }`}>
                        {step.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {step.description}
                      </div>
                    </div>
                  </div>

                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${step.id < currentStep ? "bg-purple-600" : "bg-gray-200"
                      }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    // Image upload handler
    const handleImageUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
        // Validate file type
        const validation = validateImageFile(file);
        if (!validation.isValid) {
          showError('Only JPG and JPEG images are allowed.');
          return;
        }

        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          showError('File size must be less than 5MB');
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          setSelectedImage(event.target.result);
          setShowImageEditor(true);
          setImageRotation(0);
          setImageZoom(1);
        };
        reader.readAsDataURL(file);
      }
    };

    // Image editing functions
    const handleImageSave = () => {
      if (selectedImage) {
        // Create canvas to apply transformations
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
          const size = 400; // Fixed size for profile photos
          canvas.width = size;
          canvas.height = size;

          // Clear canvas
          ctx.clearRect(0, 0, size, size);

          // Save context state
          ctx.save();

          // Move to center for rotation
          ctx.translate(size / 2, size / 2);
          ctx.rotate((imageRotation * Math.PI) / 180);
          ctx.scale(imageZoom, imageZoom);

          // Draw image centered
          const drawSize = Math.min(img.width, img.height);
          ctx.drawImage(
            img,
            (img.width - drawSize) / 2,
            (img.height - drawSize) / 2,
            drawSize,
            drawSize,
            -size / 2,
            -size / 2,
            size,
            size
          );

          // Restore context state
          ctx.restore();

          // Get the processed image as data URL
          const processedImage = canvas.toDataURL('image/jpeg', 0.9);
          console.log('Processed image saved:', processedImage.substring(0, 50) + '...');
          handleInputChange("profilePhoto", processedImage);
          setShowImageEditor(false);
          setSelectedImage(null);
        };

        img.src = selectedImage;
      }
    };

    const handleImageCancel = () => {
      setShowImageEditor(false);
      setSelectedImage(null);
      setImageRotation(0);
      setImageZoom(1);
    };

    const handleImageReset = () => {
      setImageRotation(0);
      setImageZoom(1);
    };

    // Document upload handler
    const handleDocumentUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
        // Validate file type
        const validation = validateDocumentFile(file);
        if (!validation.isValid) {
          showError(`This ${file.type} can't be uploaded`);
          return;
        }

        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          showError('File size must be less than 10MB');
          return;
        }

        // 📂 FIXED: Store the actual File object (not just metadata)
        // This way when we save, we have the real file to upload
        setFormData(prev => ({
          ...prev,
          documents: [...(prev.documents || []), file]
        }));

        // Clear the file input
        e.target.value = '';
        showSuccess(`File "${file.name}" added successfully`);
      }
    };

    // Remove document handler
    const removeDocument = (index) => {
      setFormData(prev => ({
        ...prev,
        documents: prev.documents.filter((_, i) => i !== index)
      }));
    };

    const renderStepContent = () => {
      switch (currentStep) {
        case 1:
          return renderBasicDetails();
        case 2:
          return renderAddressDetails();
        case 3:
          return renderEmergencyContact();
        case 4:
          return renderLeaveEntitlement();
        case 5:
          return renderAccountPayDetails();
        case 6:
          return renderSensitiveDetails();
        default:
          return renderBasicDetails();
      }
    };

    const renderBasicDetails = () => {
      return (
        <div className="space-y-6">
          {/* Profile Photo Upload */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Profile Photo
            </h3>
            <div className="flex items-center gap-6">
              <div className="relative">
                {formData.profilePhoto ? (
                  <img
                    src={formData.profilePhoto}
                    alt="Profile"
                    className="h-24 w-24 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-200">
                    <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  id="profilePhoto"
                  accept="image/jpeg,image/jpg"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <label
                  htmlFor="profilePhoto"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Photo
                </label>
                {formData.profilePhoto && (
                  <button
                    type="button"
                    onClick={() => handleInputChange("profilePhoto", "")}
                    className="ml-3 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove
                  </button>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  Upload a profile photo. Recommended size: 400x400px. Max file size: 5MB.
                </p>
              </div>
            </div>
          </div>

          {/* Basic details */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Basic Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <Select value={formData.title} onValueChange={(value) => handleInputChange("title", value)}>
                  <SelectTrigger className="w-full h-[42px]">
                    <SelectValue placeholder="Select Title" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mr">Mr</SelectItem>
                    <SelectItem value="Mrs">Mrs</SelectItem>
                    <SelectItem value="Miss">Miss</SelectItem>
                    <SelectItem value="Ms">Ms</SelectItem>
                    <SelectItem value="Dr">Dr</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* First name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First name{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  className={`w-full h-[42px] px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.firstName ? "border-red-500" : "border-gray-300"
                    }`}
                />
              </div>

              {/* Middle name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Middle name
                </label>
                <input
                  type="text"
                  placeholder="Middle name"
                  value={formData.middleName}
                  onChange={(e) => handleInputChange("middleName", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Last name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last name{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  className={`w-full h-[42px] px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.lastName ? "border-red-500" : "border-gray-300"
                    }`}
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender
                </label>
                <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
                  <SelectTrigger className="w-full h-[42px]">
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unspecified">Unspecified</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ethnicity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ethnicity
                </label>
                <Select value={formData.ethnicity} onValueChange={(value) => handleInputChange("ethnicity", value)}>
                  <SelectTrigger className="w-full h-[42px]">
                    <SelectValue placeholder="Select Ethnicity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unspecified">Unspecified</SelectItem>
                    <SelectItem value="Asian">Asian</SelectItem>
                    <SelectItem value="Black">Black</SelectItem>
                    <SelectItem value="White">White</SelectItem>
                    <SelectItem value="Mixed">Mixed</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date of birth */}
              <div>
                <DatePicker
                  label="Date of birth"
                  value={formData.dateOfBirth}
                  onChange={(date) => handleInputChange("dateOfBirth", date ? date.format("DD/MM/YYYY") : "")}
                  placeholder="dd/mm/yyyy"
                  format="DD/MM/YYYY"
                  className="w-full h-[42px]"
                  maxDate={getMaxDOBDate()}
                />
                {errors.dateOfBirth && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.dateOfBirth}
                  </p>
                )}
              </div>

              {/* Email address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email address{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="Email address"
                  value={formData.emailAddress}
                  onChange={(e) =>
                    handleInputChange("emailAddress", e.target.value)
                  }
                  className={`w-full h-[42px] px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.emailAddress ? "border-red-500" : "border-gray-300"
                    }`}
                />
                {emailError && (
                  <p className="text-red-500 text-xs mt-1">{emailError}</p>
                )}
              </div>

              {/* Mobile number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile number{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="Mobile number"
                  value={formData.mobileNumber}
                  onChange={(e) => handleMobileNumberChange(e, (value) => handleInputChange("mobileNumber", value))}
                  onKeyPress={preventNonMobileNumeric}
                  className={`w-full h-[42px] px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.mobileNumber ? "border-red-500" : "border-gray-300"
                    }`}
                />
                {errors.mobileNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.mobileNumber}</p>
                )}
              </div>

              {/* Work phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work phone
                </label>
                <input
                  type="tel"
                  placeholder="Work phone"
                  value={formData.workPhone}
                  onChange={(e) => handleMobileNumberChange(e, (value) => handleInputChange("workPhone", value))}
                  onKeyPress={preventNonMobileNumeric}
                  className={`w-full h-[42px] px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.workPhone ? "border-red-500" : "border-gray-300"
                    }`}
                />
                {errors.workPhone && (
                  <p className="mt-1 text-sm text-red-600">Please enter a valid mobile number.</p>
                )}
              </div>

              {/* Job title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job title{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Job title"
                  value={formData.jobTitle}
                  onChange={(e) => handleInputChange("jobTitle", e.target.value)}
                  className={`w-full h-[42px] px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.jobTitle ? "border-red-500" : "border-gray-300"
                    }`}
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Department"
                  value={formData.department}
                  onChange={(e) => handleInputChange("department", e.target.value)}
                  className={`w-full h-[42px] px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.department ? "border-red-500" : "border-gray-300"
                    }`}
                />
              </div>

              {/* Team */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team
                </label>
                <Select
                  value={formData.team || ""}
                  onValueChange={(value) => handleInputChange("team", value)}
                >
                  <SelectTrigger className="w-full h-[42px]">
                    <SelectValue placeholder="Select team (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team._id} value={team.name}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reports To (Manager) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reports To Manager
                </label>
                <select
                  value={formData.managerId}
                  onChange={(e) => handleInputChange("managerId", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">No Manager (Top Level)</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName} - {emp.jobTitle}
                    </option>
                  ))}
                </select>
              </div>

            {/* Organisation Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organisation Name{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Organisation name"
                value={formData.OrganisationName}
                onChange={(e) => handleInputChange("OrganisationName", e.target.value)}
                className={`w-full h-[42px] px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
               
               
                  errors.OrganisationName ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.OrganisationName && (
                <p className="mt-1 text-sm text-red-500">{errors.OrganisationName}</p>
              )}
            </div>

              {/* Employment start date */}
              <div>
                <DatePicker
                  label="Employment start date"
                  required
                  value={formData.employmentStartDate}
                  onChange={(date) => handleInputChange("employmentStartDate", date ? date.format("DD/MM/YYYY") : "")}
                  placeholder="dd/mm/yyyy"
                  format="DD/MM/YYYY"
                  className="w-full"
                  maxDate={getMaxStartDate()}
                />
                {errors.employmentStartDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.employmentStartDate}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Probation end date */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Probation Period
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <DatePicker
                  label="Probation end date"
                  required
                  value={formData.probationEndDate}
                  onChange={(date) => handleInputChange("probationEndDate", date ? date.format("DD/MM/YYYY") : "")}
                  placeholder="dd/mm/yyyy"
                  format="DD/MM/YYYY"
                  className="w-full"
                  minDate={getMinProbationDate()}
                />
                {errors.probationEndDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.probationEndDate}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    };

    const renderAddressDetails = () => {
      return (
        <div className="space-y-6">
          {/* Address details */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Address Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address 1
                </label>
                <input
                  type="text"
                  placeholder="Address 1"
                  value={formData.address1}
                  onChange={(e) => handleInputChange("address1", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address 2
                </label>
                <input
                  type="text"
                  placeholder="Address 2"
                  value={formData.address2}
                  onChange={(e) => handleInputChange("address2", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address 3
                </label>
                <input
                  type="text"
                  placeholder="Address 3"
                  value={formData.address3}
                  onChange={(e) => handleInputChange("address3", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Town/City
                </label>
                <input
                  type="text"
                  placeholder="Town/City"
                  value={formData.townCity}
                  onChange={(e) => handleInputChange("townCity", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  County
                </label>
                <input
                  type="text"
                  placeholder="County"
                  value={formData.county}
                  onChange={(e) => handleInputChange("county", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Postcode
                </label>
                <input
                  type="text"
                  placeholder="Postcode"
                  value={formData.postcode}
                  onChange={(e) => handleInputChange("postcode", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      );
    };

    const renderEmergencyContact = () => {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Emergency Contact
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">i</span>
                </div>
                <p className="text-sm text-gray-700">
                  Add an emergency contact in case something unexpected happens.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Name
                </label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={formData.emergencyContactName}
                  onChange={(e) => handleInputChange("emergencyContactName", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relationship
                </label>
                <Select value={formData.emergencyContactRelation} onValueChange={(value) => handleInputChange("emergencyContactRelation", value)}>
                  <SelectTrigger className="w-full h-[42px]">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Spouse">Spouse</SelectItem>
                    <SelectItem value="Parent">Parent</SelectItem>
                    <SelectItem value="Sibling">Sibling</SelectItem>
                    <SelectItem value="Child">Child</SelectItem>
                    <SelectItem value="Friend">Friend</SelectItem>
                    <SelectItem value="Partner">Partner</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => handleMobileNumberChange(e, (value) => handleInputChange("emergencyContactPhone", value))}
                  onKeyPress={preventNonMobileNumeric}
                  className={`w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${errors.emergencyContactPhone ? "border-red-500" : "border-gray-300"
                    }`}
                />
                {errors.emergencyContactPhone && (
                  <p className="mt-1 text-sm text-red-600">Please enter a valid mobile number.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Email address"
                  value={formData.emergencyContactEmail}
                  onChange={(e) => handleInputChange("emergencyContactEmail", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      );
    };

    const renderLeaveEntitlement = () => {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Leave Entitlement
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">i</span>
                </div>
                <p className="text-sm text-gray-700">
                  This step is optional. You can skip it and update leave values later.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Leave entitlement
                </label>
                <input
                  id={fieldId('leaveEntitlement')}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 28"
                  value={formData.leaveEntitlement}
                  onChange={(e) => handleInputChange('leaveEntitlement', e.target.value)}
                  className={getInputClass('leaveEntitlement')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Leave allowance
                </label>
                <input
                  id={fieldId('leaveAllowance')}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 10"
                  value={formData.leaveAllowance}
                  onChange={(e) => handleInputChange('leaveAllowance', e.target.value)}
                  className={getInputClass('leaveAllowance')}
                />
              </div>
            </div>
          </div>
        </div>
      );
    };

    const renderAccountPayDetails = () => {
      return (
        <div className="space-y-6">
          {/* Salary details */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Salary Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Salary
                </label>
                <input
                  type="number"
                  value={formData.salary}
                  onChange={(e) => handleInputChange("salary", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rate
                </label>
                <Select value={formData.rate} onValueChange={(value) => handleInputChange("rate", value)}>
                  <SelectTrigger className="w-full h-[42px]">
                    <SelectValue placeholder="Select rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hourly">Hourly</SelectItem>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment frequency
                </label>
                <Select value={formData.paymentFrequency} onValueChange={(value) => handleInputChange("paymentFrequency", value)}>
                  <SelectTrigger className="w-full h-[42px]">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Bi-weekly">Bi-weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payroll number
                </label>
                <input
                  type="text"
                  placeholder="ABC123"
                  value={formData.payrollNumber}
                  onChange={(e) => handleInputChange("payrollNumber", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Bank details */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Bank Details
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  placeholder="Account name"
                  value={formData.accountName}
                  onChange={(e) => handleInputChange("accountName", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name of bank
                </label>
                <input
                  type="text"
                  placeholder="Bank name"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange("bankName", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account number
                </label>
                <input
                  type="text"
                  placeholder="8 digit number"
                  value={formData.accountNumber}
                  onChange={(e) => handleInputChange("accountNumber", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort code
                </label>
                <input
                  type="text"
                  placeholder="00-00-00"
                  value={formData.sortCode}
                  onChange={(e) => handleInputChange("sortCode", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      );
    };

    const renderSensitiveDetails = () => {
      return (
        <div className="space-y-6">
          {/* Tax and NI */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Tax & NI Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax code
                </label>
                <input
                  type="text"
                  placeholder="Tax code"
                  value={formData.taxCode}
                  onChange={(e) => handleInputChange("taxCode", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NI number
                </label>
                <input
                  type="text"
                  placeholder="NI number"
                  value={formData.niNumber}
                  onChange={(e) => handleInputChange("niNumber", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Passport */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Passport</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Passport number
                </label>
                <input
                  type="text"
                  placeholder="Passport number"
                  value={formData.passportNumber}
                  onChange={(e) => handleInputChange("passportNumber", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country of issue
                </label>
                <Select value={formData.passportCountry} onValueChange={(value) => handleInputChange("passportCountry", value)}>
                  <SelectTrigger className="w-full h-[42px]">
                    <SelectValue placeholder="Country of issue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                    <SelectItem value="United States">United States</SelectItem>
                    <SelectItem value="India">India</SelectItem>
                    <SelectItem value="Pakistan">Pakistan</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <DatePicker
                  label="Passport expiry date"
                  value={formData.passportExpiryDate}
                  onChange={(date) => handleInputChange("passportExpiryDate", date ? date.format("DD/MM/YYYY") : "")}
                  placeholder="dd/mm/yyyy"
                  format="DD/MM/YYYY"
                  className="w-full h-[42px]"
                />
              </div>
            </div>
          </div>

          {/* Driving licence */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Driving Licence
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Licence number
                </label>
                <input
                  type="text"
                  placeholder="Licence number"
                  value={formData.licenceNumber}
                  onChange={(e) => handleInputChange("licenceNumber", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country of issue
                </label>
                <Select value={formData.licenceCountry} onValueChange={(value) => handleInputChange("licenceCountry", value)}>
                  <SelectTrigger className="w-full h-[42px]">
                    <SelectValue placeholder="Country of issue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                    <SelectItem value="United States">United States</SelectItem>
                    <SelectItem value="India">India</SelectItem>
                    <SelectItem value="Pakistan">Pakistan</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <DatePicker
                  label="Date of expiry"
                  value={formData.licenceExpiryDate}
                  onChange={(date) => handleInputChange("licenceExpiryDate", date ? date.format("DD/MM/YYYY") : "")}
                  placeholder="dd/mm/yyyy"
                  format="DD/MM/YYYY"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Visa */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Visa</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visa number
                </label>
                <input
                  type="text"
                  placeholder="Visa number"
                  value={formData.visaNumber}
                  onChange={(e) => handleInputChange("visaNumber", e.target.value)}
                  className="w-full h-[42px] px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <DatePicker
                  label="Visa expiry date"
                  value={formData.visaExpiryDate}
                  onChange={(date) => handleInputChange("visaExpiryDate", date ? date.format("DD/MM/YYYY") : "")}
                  placeholder="dd/mm/yyyy"
                  format="DD/MM/YYYY"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Document Upload */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Documents</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Documents (PDF only)
                </label>
                <input
                  type="file"
                  id="documentUpload"
                  accept="application/pdf"
                  onChange={handleDocumentUpload}
                  className="hidden"
                />
                <label
                  htmlFor="documentUpload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Document
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  Upload PDF documents only. Max file size: 10MB.
                </p>
                {formData.documents && formData.documents.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h5 className="text-sm font-medium text-gray-700">Uploaded Documents:</h5>
                    {formData.documents.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <span className="text-sm text-gray-700">{doc.name}</span>
                        <button
                          type="button"
                          onClick={() => removeDocument(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title={isEditMode ? 'Back to Employee Profile' : 'Back to Employee Hub'}
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span className="font-medium">
                {isEditMode ? 'Back to Profile' : 'Back to Hub'}
              </span>
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isEditMode ? 'Edit Employee' : 'Add Employee'}
          </h1>
          <p className="text-gray-600">
            {isEditMode
              ? `Update employee information using the ${totalSteps}-step form below`
              : `Follow the simple ${totalSteps} steps to complete your employee creation`
            }
          </p>
        </div>

        {/* Form Container */}
        <div className="max-w-6xl mx-auto bg-white rounded-lg border border-gray-200 p-8">
          {/* Step Indicator */}
          {renderStepIndicator()}

          {/* Step Content */}
          <div className="mb-8">
            {renderStepContent()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${currentStep === 1
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
              Prev
            </button>

            <div className="flex gap-4">
              <button
                onClick={handleCancel}
                className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors"
                disabled={loading}
              >
                Cancel
              </button>

              {currentStep === totalSteps ? (
                <button
                  onClick={handleSaveEmployee}
                  disabled={loading}
                  className="px-8 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Save Employee')}
                </button>
              ) : (
                <button
                  onClick={nextStep}
                  className="px-8 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Image Editor Modal */}
        {showImageEditor && selectedImage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Edit Image</h2>
                <button
                  onClick={handleImageCancel}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1">
                {/* Image Preview */}
                <div className="relative bg-gray-100 rounded-lg overflow-hidden mb-6" style={{ height: '400px' }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      {/* Circular crop overlay */}
                      <div className="absolute inset-0 border-4 border-white rounded-full shadow-lg" style={{ width: '300px', height: '300px', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}></div>

                      <img
                        src={selectedImage}
                        alt="Preview"
                        className="max-w-none"
                        style={{
                          transform: `rotate(${imageRotation}deg) scale(${imageZoom})`,
                          transformOrigin: 'center center',
                          width: '400px',
                          height: '400px',
                          objectFit: 'cover'
                        }}
                      />

                      {/* Drag instruction overlay */}
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
                        Drag to reposition image
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="space-y-4">
                  {/* Rotate Control */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700 w-16">Rotate</label>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500">|</span>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={imageRotation}
                        onChange={(e) => setImageRotation(parseInt(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs text-gray-500">|</span>
                      <span className="text-sm font-medium text-gray-700 w-8">{imageRotation}</span>
                    </div>
                  </div>

                  {/* Zoom Control */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700 w-16">Zoom</label>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500">●</span>
                      <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={imageZoom}
                        onChange={(e) => setImageZoom(parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs text-gray-500">●</span>
                      <span className="text-sm font-medium text-gray-700 w-8">{imageZoom.toFixed(1)}</span>
                    </div>
                    <button
                      onClick={handleImageReset}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={handleImageCancel}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImageSave}
                  className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }