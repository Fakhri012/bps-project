
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
    downloadAnnualTemplate,
    detectWorkbookSheets,
    previewAnnualUpload
} = require('../controllers/dataImportController');
const {
    cancelImportBatch,
    confirmImportBatch,
    getAuditTrail,
    getImportBatchDetail,
    getManagementSummary,
    listImportBatches,
    getVersionDetail,
    listVersions,
    retryDashboardCache,
    restoreVersion,
    softDeleteVersion
} = require('../controllers/dataManagementController');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| TEMPORARY UPLOAD CONFIGURATION
|--------------------------------------------------------------------------
*/

const TEMP_UPLOAD_DIR = path.resolve(
    __dirname,
    '../../storage/temporary-uploads'
);

fs.mkdirSync(TEMP_UPLOAD_DIR, {
    recursive: true
});

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, TEMP_UPLOAD_DIR);
    },

    filename: (req, file, callback) => {
        const uniqueName =
            `${Date.now()}-${require('crypto').randomUUID()}.xlsx`;

        callback(null, uniqueName);
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: 15 * 1024 * 1024,
        files: 1
    },

    fileFilter: (req, file, callback) => {
        const extension = path.extname(
            file.originalname
        ).toLowerCase();

        if (extension !== '.xlsx') {
            return callback(
                new Error('Format file tidak didukung. Gunakan file .xlsx.')
            );
        }

        callback(null, true);
    }
});

/*
|--------------------------------------------------------------------------
| MULTER ERROR HANDLER
|--------------------------------------------------------------------------
*/

function uploadSingleExcel(req, res, next) {
    upload.single('file')(req, res, error => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError) {
            const status = error.code === 'LIMIT_FILE_SIZE'
                ? 413
                : 400;

            return res.status(status).json({
                success: false,
                message: error.code === 'LIMIT_FILE_SIZE'
                    ? 'Ukuran file maksimal 15 MB.'
                    : error.message
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message || 'Upload file gagal.'
        });
    });
}

/*
|--------------------------------------------------------------------------
| DOWNLOAD TEMPLATE
|--------------------------------------------------------------------------
*/

router.get(
    '/templates/tahunan',
    downloadAnnualTemplate
);

router.get(
    '/templates/:datasetKey',
    downloadAnnualTemplate
);

/*
|--------------------------------------------------------------------------
| UPLOAD AND PREVIEW
|--------------------------------------------------------------------------
|
| POST /api/data-import/preview?tahun=2026
|
| multipart/form-data:
| file = Excel .xlsx
|--------------------------------------------------------------------------
*/

router.post(
    '/detect',
    uploadSingleExcel,
    detectWorkbookSheets
);

router.post(
    '/preview',
    uploadSingleExcel,
    previewAnnualUpload
);

router.post(
    '/preview/:datasetKey',
    uploadSingleExcel,
    previewAnnualUpload
);

router.get('/management/summary', getManagementSummary);
router.get('/management/batches', listImportBatches);
router.get('/management/batches/:batchId', getImportBatchDetail);
router.post('/management/batches/:batchId/confirm', confirmImportBatch);
router.post('/management/batches/:batchId/cancel', cancelImportBatch);
router.get('/management/versions/:versionId', getVersionDetail);
router.get('/management/versions', listVersions);
router.post('/management/cache/retry', retryDashboardCache);
router.post('/management/versions/:versionId/restore', restoreVersion);
router.post('/management/versions/:versionId/delete', softDeleteVersion);
router.get('/management/audit', getAuditTrail);

module.exports = router;
