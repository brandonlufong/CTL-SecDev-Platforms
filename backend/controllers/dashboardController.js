const Vulnerability = require('../models/Vulnerability');
const Asset = require('../models/Asset');

exports.getDashboardSummary = async (req, res) => {
  try {
    const totalVulnerabilities = await Vulnerability.countDocuments();
    const openVulnerabilities = await Vulnerability.countDocuments({ status: 'Open' });
    const resolvedVulnerabilities = await Vulnerability.countDocuments({ status: 'Resolved' });
    const inprogressVulnerabilities = await Vulnerability.countDocuments({ status: 'In Progress' });
    const totalAssets = await Asset.countDocuments();
    const criticalOpenCount = await Vulnerability.countDocuments({ severity: 'Critical', status: 'Open' });

    const severityAggregation = await Vulnerability.aggregate([
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);

    const statusAggregation = await Vulnerability.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const severityCount = {};
    const statusCount = {};

    severityAggregation.forEach(item => {
      severityCount[item._id] = item.count;
    });

    statusAggregation.forEach(item => {
      statusCount[item._id] = item.count;
    });

    res.json({
      totalVulnerabilities,
      openVulnerabilities,
      resolvedVulnerabilities,
      inprogressVulnerabilities,
      criticalOpenCount,
      totalAssets,
      severityCount,
      statusCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
