const Vulnerability = require('../models/Vulnerability');
const Asset = require('../models/Asset');
const Device = require('../models/Device');

exports.getDashboardSummary = async (req, res) => {
  try {
    // Vulnerability metrics
    const totalVulnerabilities = await Vulnerability.countDocuments();
    const openVulnerabilities = await Vulnerability.countDocuments({ status: 'Open' });
    const resolvedVulnerabilities = await Vulnerability.countDocuments({ status: 'Resolved' });
    const inprogressVulnerabilities = await Vulnerability.countDocuments({ status: 'In Progress' });
    const criticalOpenCount = await Vulnerability.countDocuments({ severity: 'Critical', status: 'Open' });

    // Asset metrics (both servers and devices)
    const totalAssets = await Asset.countDocuments();
    const totalDevices = await Device.countDocuments();
    const onlineAssets = await Asset.countDocuments({ status: 'Online' });
    const offlineAssets = await Asset.countDocuments({ status: 'Offline' });
    const maintenanceAssets = await Asset.countDocuments({ status: 'Maintenance' });
    const onlineDevices = await Device.countDocuments({ status: 'Online' });
    const offlineDevices = await Device.countDocuments({ status: 'Offline' });

    // Vulnerability aggregations
    const severityAggregation = await Vulnerability.aggregate([
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);

    const statusAggregation = await Vulnerability.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Asset type aggregations
    const assetTypeAggregation = await Asset.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const deviceCategoryAggregation = await Device.aggregate([
      { $group: { _id: '$deviceCategory', count: { $sum: 1 } } }
    ]);

    // Format counts
    const severityCount = {};
    const statusCount = {};
    const assetTypes = {};
    const deviceCategories = {};

    severityAggregation.forEach(item => {
      severityCount[item._id] = item.count;
    });

    statusAggregation.forEach(item => {
      statusCount[item._id] = item.count;
    });

    assetTypeAggregation.forEach(item => {
      assetTypes[item._id] = item.count;
    });

    deviceCategoryAggregation.forEach(item => {
      deviceCategories[item._id] = item.count;
    });

    // Calculate risk metrics
    const highRiskAssets = await Asset.countDocuments({ 
      $or: [
        { status: 'Offline' },
        { exposure: 'Public' }
      ]
    });

    const recentVulns = await Vulnerability.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    res.json({
      // Vulnerability metrics
      totalVulnerabilities,
      openVulnerabilities,
      resolvedVulnerabilities,
      inprogressVulnerabilities,
      criticalOpenCount,
      recentVulnerabilities: recentVulns,
      
      // Asset metrics
      totalAssets: totalAssets + totalDevices,
      serverAssets: totalAssets,
      networkDevices: totalDevices,
      onlineAssets: onlineAssets + onlineDevices,
      offlineAssets: offlineAssets + offlineDevices,
      maintenanceAssets,
      highRiskAssets,
      
      // Aggregations
      severityCount,
      statusCount,
      assetTypes,
      deviceCategories,
      
      // System metrics
      scanStatus: 'idle',
      lastScan: new Date().toISOString()
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};
