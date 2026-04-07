const networkDetectionService = require('../services/networkDetectionService');

exports.test = async (req, res) => {
  try {
    console.log('test function called');
    res.json({ message: 'Test endpoint working' });
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ message: 'Test failed' });
  }
};
