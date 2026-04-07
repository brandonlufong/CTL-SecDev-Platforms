@echo off
echo const express = require('express'); > routes\assetDiscoveryRoutes.js
echo const router = express.Router(); >> routes\assetDiscoveryRoutes.js
echo const { verifyToken } = require('../middleware/authMiddleware'); >> routes\assetDiscoveryRoutes.js
echo const assetDiscoveryController = require('../controllers/assetDiscoveryController_new'); >> routes\assetDiscoveryRoutes.js
echo. >> routes\assetDiscoveryRoutes.js
echo // Detect current network configuration >> routes\assetDiscoveryRoutes.js
echo router.get('/detect', verifyToken, assetDiscoveryController.detectNetwork); >> routes\assetDiscoveryRoutes.js
echo. >> routes\assetDiscoveryRoutes.js
echo // Get common network ranges >> routes\assetDiscoveryRoutes.js
echo router.get('/common-ranges', verifyToken, assetDiscoveryController.getCommonRanges); >> routes\assetDiscoveryRoutes.js
echo. >> routes\assetDiscoveryRoutes.js
echo // Validate network range >> routes\assetDiscoveryRoutes.js
echo router.get('/validate/:networkRange', verifyToken, assetDiscoveryController.validateNetworkRange); >> routes\assetDiscoveryRoutes.js
echo. >> routes\assetDiscoveryRoutes.js
echo // Start asset discovery >> routes\assetDiscoveryRoutes.js
echo router.post('/start', verifyToken, assetDiscoveryController.startDiscovery); >> routes\assetDiscoveryRoutes.js
echo. >> routes\assetDiscoveryRoutes.js
echo // Get discovery status >> routes\assetDiscoveryRoutes.js
echo router.get('/status', verifyToken, assetDiscoveryController.getDiscoveryStatus); >> routes\assetDiscoveryRoutes.js
echo. >> routes\assetDiscoveryRoutes.js
echo // Cancel discovery >> routes\assetDiscoveryRoutes.js
echo router.post('/cancel', verifyToken, assetDiscoveryController.cancelDiscovery); >> routes\assetDiscoveryRoutes.js
echo. >> routes\assetDiscoveryRoutes.js
echo // Get discovery history >> routes\assetDiscoveryRoutes.js
echo router.get('/history', verifyToken, assetDiscoveryController.getDiscoveryHistory); >> routes\assetDiscoveryRoutes.js
echo. >> routes\assetDiscoveryRoutes.js
echo // Import discovered assets >> routes\assetDiscoveryRoutes.js
echo router.post('/import', verifyToken, assetDiscoveryController.importDiscoveredAssets); >> routes\assetDiscoveryRoutes.js
echo. >> routes\assetDiscoveryRoutes.js
echo module.exports = router; >> routes\assetDiscoveryRoutes.js
