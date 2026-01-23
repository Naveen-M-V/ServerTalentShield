const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const DocumentManagement = require('../models/DocumentManagement');

// Configure multer for E-Learning uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'elearning');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'elearning-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
      'application/vnd.ms-powerpoint', // ppt
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/msword' // doc
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, PPT, PPTX, DOC, and DOCX files are allowed.'));
    }
  }
});

// Middleware: Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/**
 * POST /api/elearning/upload
 * Upload E-Learning material (admin only)
 */
router.post('/upload', isAdmin, upload.single('file'), async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // Create E-Learning material record using DocumentManagement model
    const material = await DocumentManagement.create({
      name: title,
      description: description || '',
      fileUrl: `/uploads/elearning/${req.file.filename}`,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user._id || req.user.userId || req.user.id,
      uploadedByRole: req.user.role,
      category: 'elearning',
      accessControl: {
        visibility: 'all'
      },
      isActive: true,
      isArchived: false
    });

    console.log('E-Learning material uploaded:', material._id);

    res.status(201).json({
      message: 'E-Learning material uploaded successfully',
      data: material
    });
  } catch (error) {
    console.error('E-Learning upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/elearning
 * Get all E-Learning materials (all authenticated users)
 */
router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const materials = await DocumentManagement.find({
      category: 'elearning',
      isActive: true,
      isArchived: false
    })
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: materials
    });
  } catch (error) {
    console.error('Get E-Learning materials error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/elearning/:id
 * Soft delete E-Learning material (admin only)
 */
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const material = await DocumentManagement.findById(req.params.id);

    if (!material) {
      return res.status(404).json({ message: 'E-Learning material not found' });
    }

    if (material.category !== 'elearning') {
      return res.status(400).json({ message: 'Not an E-Learning material' });
    }

    // Soft delete
    material.isActive = false;
    await material.save();

    console.log('E-Learning material deleted:', material._id);

    res.json({
      message: 'E-Learning material deleted successfully'
    });
  } catch (error) {
    console.error('Delete E-Learning material error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
