const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/schedulerController');

router.use(verifyToken);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.post('/:id/run', ctrl.runNow);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
