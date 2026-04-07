const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const testController = require('../controllers/testController');

router.get('/test', verifyToken, testController.test);

module.exports = router;
