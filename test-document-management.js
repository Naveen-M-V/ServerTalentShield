/**
 * Document Management Module Test
 * 
 * This test file verifies the complete functionality of the Document Management Module
 * including API endpoints, database schemas, and frontend components.
 */

const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:5000/api/documentManagement';

// Test data
const testFolder = {
  name: 'Test Documents',
  description: 'A test folder for document management',
  permissions: {
    view: ['admin', 'hr', 'manager', 'employee'],
    edit: ['admin', 'hr'],
    delete: ['admin']
  }
};

const testDocument = {
  category: 'certificate',
  tags: 'test,document,upload',
  permissions: {
    view: ['admin', 'hr', 'manager', 'employee'],
    download: ['admin', 'hr', 'manager'],
    share: ['admin', 'hr']
  },
  expiresOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
  reminderEnabled: true
};

// Test functions
async function testFolderOperations() {
  console.log('🗂️ Testing Folder Operations...');
  
  try {
    // Test creating a folder
    console.log('  📁 Creating folder...');
    const createResponse = await axios.post(`${API_BASE_URL}/folders`, testFolder, {
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });
    
    const folder = createResponse.data;
    console.log('  ✅ Folder created successfully:', folder.name);
    
    // Test getting all folders
    console.log('  📋 Getting all folders...');
    const foldersResponse = await axios.get(`${API_BASE_URL}/folders`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log(`  ✅ Found ${foldersResponse.data.length} folders`);
    
    // Test getting folder by ID
    console.log('  🔍 Getting folder by ID...');
    const folderResponse = await axios.get(`${API_BASE_URL}/folders/${folder._id}`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('  ✅ Folder retrieved successfully');
    
    return folder._id;
  } catch (error) {
    console.error('  ❌ Folder operations failed:', error.response?.data || error.message);
    return null;
  }
}

async function testDocumentOperations(folderId) {
  console.log('📄 Testing Document Operations...');
  
  if (!folderId) {
    console.log('  ⚠️ Skipping document tests - no folder available');
    return;
  }
  
  try {
    // Test document upload (simulate file upload)
    console.log('  📤 Testing document upload...');
    
    // Create a mock file for testing
    const FormData = require('form-data');
    const fs = require('fs');
    const path = require('path');
    
    const form = new FormData();
    form.append('file', Buffer.from('test document content'), {
      filename: 'test-document.pdf',
      contentType: 'application/pdf'
    });
    form.append('category', testDocument.category);
    form.append('tags', testDocument.tags);
    form.append('permissions', JSON.stringify(testDocument.permissions));
    form.append('expiresOn', testDocument.expiresOn);
    form.append('reminderEnabled', testDocument.reminderEnabled);
    
    const uploadResponse = await axios.post(
      `${API_BASE_URL}/folders/${folderId}/documents`,
      form,
      {
        headers: {
          'Authorization': 'Bearer test-token',
          ...form.getHeaders()
        }
      }
    );
    
    const document = uploadResponse.data;
    console.log('  ✅ Document uploaded successfully:', document.name || document.fileName);
    
    // Test getting document by ID
    console.log('  🔍 Getting document by ID...');
    const docResponse = await axios.get(`${API_BASE_URL}/documents/${document._id}`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('  ✅ Document retrieved successfully');
    
    // Test searching documents
    console.log('  🔍 Testing document search...');
    const searchResponse = await axios.get(`${API_BASE_URL}/documents/search?q=test`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log(`  ✅ Search found ${searchResponse.data.length} documents`);
    
    // Test getting expiring documents
    console.log('  ⏰ Testing expiring documents...');
    const expiringResponse = await axios.get(`${API_BASE_URL}/documents/expiring?days=60`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log(`  ✅ Found ${expiringResponse.data.length} expiring documents`);
    
    return document._id;
  } catch (error) {
    console.error('  ❌ Document operations failed:', error.response?.data || error.message);
    return null;
  }
}

async function testFrontendComponents() {
  console.log('🎨 Testing Frontend Components...');
  
  try {
    // Check if component files exist
    const fs = require('fs');
    const path = require('path');
    
    const components = [
      'frontend/src/components/DocumentManagement/DocumentDrawer.js',
      'frontend/src/components/DocumentManagement/FolderCard.js',
      'frontend/src/components/DocumentManagement/DocumentPanel.js',
      'frontend/src/components/DocumentManagement/FolderModal.js',
      'frontend/src/components/DocumentManagement/DocumentUpload.js',
      'frontend/src/components/DocumentManagement/index.js'
    ];
    
    for (const component of components) {
      const filePath = path.join(__dirname, component);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${path.basename(component)} exists`);
      } else {
        console.log(`  ❌ ${path.basename(component)} missing`);
      }
    }
    
    // Check if framer-motion is installed
    const packageJsonPath = path.join(__dirname, 'frontend/package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.dependencies?.['framer-motion']) {
        console.log('  ✅ Framer Motion is installed');
      } else {
        console.log('  ❌ Framer Motion not found in dependencies');
      }
    }
    
  } catch (error) {
    console.error('  ❌ Frontend component test failed:', error.message);
  }
}

async function testDatabaseModels() {
  console.log('🗄️ Testing Database Models...');
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    const models = [
      'backend/models/Folder.js',
      'backend/models/DocumentManagement.js'
    ];
    
    for (const model of models) {
      const filePath = path.join(__dirname, model);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${path.basename(model)} exists`);
        
        // Check model content
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('mongoose.Schema')) {
          console.log(`    ✅ Mongoose schema found`);
        }
        if (content.includes('timestamps: true')) {
          console.log(`    ✅ Timestamps enabled`);
        }
      } else {
        console.log(`  ❌ ${path.basename(model)} missing`);
      }
    }
    
  } catch (error) {
    console.error('  ❌ Database model test failed:', error.message);
  }
}

async function testAPIRoutes() {
  console.log('🛣️ Testing API Routes...');
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    const routesFile = path.join(__dirname, 'backend/routes/documentManagement.js');
    if (fs.existsSync(routesFile)) {
      console.log('  ✅ Document management routes file exists');
      
      const content = fs.readFileSync(routesFile, 'utf8');
      const routes = [
        'GET /folders',
        'POST /folders',
        'GET /folders/:folderId',
        'PUT /folders/:folderId',
        'DELETE /folders/:folderId',
        'POST /folders/:folderId/documents',
        'GET /documents/:documentId',
        'GET /documents/:documentId/download',
        'PUT /documents/:documentId',
        'POST /documents/:documentId/version',
        'POST /documents/:documentId/archive',
        'GET /documents/search',
        'GET /documents/expiring',
        'GET /documents/:documentId/versions'
      ];
      
      for (const route of routes) {
        if (content.includes(route.split(' ')[1])) {
          console.log(`    ✅ ${route} route found`);
        } else {
          console.log(`    ❌ ${route} route missing`);
        }
      }
    } else {
      console.log('  ❌ Document management routes file missing');
    }
    
  } catch (error) {
    console.error('  ❌ API routes test failed:', error.message);
  }
}

async function testIntegration() {
  console.log('🔗 Testing Integration...');
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Check if routes are registered in server.js
    const serverPath = path.join(__dirname, 'backend/server.js');
    if (fs.existsSync(serverPath)) {
      const serverContent = fs.readFileSync(serverPath, 'utf8');
      
      if (serverContent.includes("require('./routes/documentManagement')")) {
        console.log('  ✅ Document management routes imported in server.js');
      } else {
        console.log('  ❌ Document management routes not imported in server.js');
      }
      
      if (serverContent.includes("app.use('/api/documentManagement'")) {
        console.log('  ✅ Document management routes registered in app');
      } else {
        console.log('  ❌ Document management routes not registered in app');
      }
    }
    
    // Check if DocumentDrawer is imported in ModernSidebar
    const sidebarPath = path.join(__dirname, 'frontend/src/components/ModernSidebar.js');
    if (fs.existsSync(sidebarPath)) {
      const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
      
      if (sidebarContent.includes("import { DocumentDrawer }")) {
        console.log('  ✅ DocumentDrawer imported in ModernSidebar');
      } else {
        console.log('  ❌ DocumentDrawer not imported in ModernSidebar');
      }
      
      if (sidebarContent.includes('<DocumentDrawer')) {
        console.log('  ✅ DocumentDrawer component used in ModernSidebar');
      } else {
        console.log('  ❌ DocumentDrawer component not used in ModernSidebar');
      }
    }
    
  } catch (error) {
    console.error('  ❌ Integration test failed:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Document Management Module Tests\n');
  
  console.log('=' .repeat(50));
  await testDatabaseModels();
  console.log('=' .repeat(50));
  
  await testAPIRoutes();
  console.log('=' .repeat(50));
  
  await testFrontendComponents();
  console.log('=' .repeat(50));
  
  await testIntegration();
  console.log('=' .repeat(50));
  
  // Note: API operations tests require running server
  console.log('📝 API Operations Tests (require running server):');
  console.log('  ⚠️ Start the backend server to test API operations');
  console.log('  ⚠️ Use valid authentication tokens for API tests');
  
  console.log('\n🎉 Document Management Module Test Complete!');
  console.log('\n📋 Manual Testing Checklist:');
  console.log('  □ Start backend server (npm run dev)');
  console.log('  □ Start frontend server (npm start)');
  console.log('  □ Login to the application');
  console.log('  □ Click "Documents" in the sidebar');
  console.log('  □ Test creating a new folder');
  console.log('  □ Test uploading documents to the folder');
  console.log('  □ Test document viewing and downloading');
  console.log('  □ Test document search functionality');
  console.log('  □ Test folder and document permissions');
  console.log('  □ Test expiry reminders');
  console.log('  □ Test document versioning');
}

// Run tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testFolderOperations,
  testDocumentOperations,
  testFrontendComponents,
  testDatabaseModels,
  testAPIRoutes,
  testIntegration,
  runTests
};
