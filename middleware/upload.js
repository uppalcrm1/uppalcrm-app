const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
const importsDir = path.join(uploadsDir, 'imports');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(importsDir)) {
  fs.mkdirSync(importsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, importsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and organization ID
    const organizationId = req.user?.organizationId || 'unknown';
    const timestamp = Date.now();
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${organizationId}_${timestamp}_${sanitizedOriginalName}`;
    cb(null, filename);
  }
});

// File filter for CSV files only
const fileFilter = (req, file, cb) => {
  // Check file extension
  const allowedExtensions = ['.csv'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    return cb(new Error('Only CSV files are allowed'), false);
  }

  // Check MIME type
  const allowedMimeTypes = [
    'text/csv',
    'text/plain',
    'application/csv',
    'application/excel',
    'application/vnd.ms-excel',
    'application/vnd.msexcel'
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only CSV files are allowed'), false);
  }

  cb(null, true);
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Only one file at a time
  }
});

// Middleware to handle single file upload
const uploadSingle = upload.single('csvFile');

// Enhanced upload middleware with error handling
const uploadMiddleware = (req, res, next) => {
  uploadSingle(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      switch (err.code) {
        case 'LIMIT_FILE_SIZE':
          return res.status(400).json({
            error: 'File too large',
            message: 'File size must be less than 50MB'
          });
        case 'LIMIT_FILE_COUNT':
          return res.status(400).json({
            error: 'Too many files',
            message: 'Only one file can be uploaded at a time'
          });
        case 'LIMIT_UNEXPECTED_FILE':
          return res.status(400).json({
            error: 'Unexpected field',
            message: 'File must be uploaded with field name "csvFile"'
          });
        default:
          return res.status(400).json({
            error: 'Upload error',
            message: err.message
          });
      }
    } else if (err) {
      // Custom errors (like file type validation)
      return res.status(400).json({
        error: 'Upload error',
        message: err.message
      });
    }

    // No error, proceed to next middleware
    next();
  });
};

// Cleanup function to remove old import files
const cleanupOldFiles = () => {
  try {
    const files = fs.readdirSync(importsDir);
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const now = Date.now();

    files.forEach(file => {
      const filePath = path.join(importsDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up old import file: ${file}`);
      }
    });
  } catch (error) {
    console.error('Error cleaning up old import files:', error);
  }
};

// Run cleanup on module load and then periodically
cleanupOldFiles();
setInterval(cleanupOldFiles, 24 * 60 * 60 * 1000); // Run daily

module.exports = {
  uploadMiddleware,
  uploadsDir,
  importsDir,
  cleanupOldFiles
};