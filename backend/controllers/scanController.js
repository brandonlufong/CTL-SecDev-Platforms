const Asset = require('../models/Asset');
const ScanResult = require('../models/ScanResult');
const Vulnerability = require('../models/Vulnerability');
const { runNmapScan } = require('../services/scannerService');
const progressTracker = require('../services/scanProgress');

exports.scanAsset = async (req, res) => {
  try {
    const { assetId } = req.body;
    const asset = await Asset.findById(assetId);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    const scanLogs = await runNmapScan(asset.ip);
    const savedResults = [];

    for (const result of scanLogs) {
      const scan = await ScanResult.create({
        ...result,
        asset: asset._id,
      });

      const vulnerabilityIds = [];

      for (const vulnTitle of result.vulnerabilities || []) {
        const vuln = await Vulnerability.findOneAndUpdate(
          { title: vulnTitle, asset: asset._id },
          {
            title: vulnTitle,
            severity: 'Medium',
            description: vulnTitle,
            asset: asset._id,
            scanResult: scan._id,
          },
          { upsert: true, new: true }
        );

        vulnerabilityIds.push(vuln._id);
      }

      scan.vulnerabilities = vulnerabilityIds;
      await scan.save();

      // ✅ Populate asset name and vulnerabilities before pushing
      const populatedScan = await ScanResult.findById(scan._id)
        .populate('asset', 'name ip')
        .populate('vulnerabilities', 'title severity status');
      savedResults.push(populatedScan);
    }

    res.json({
      success: true,
      logs: savedResults,
      message: `Scan completed for asset: ${asset.name}`,
    });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ message: 'Scan failed', error: err.message });
  }
};

exports.getLatestScans = async (req, res) => {
  try {
    const latestScans = await ScanResult.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('asset', 'name ip')
      .populate('vulnerabilities', 'title severity status');

    res.json(latestScans);
  } catch (err) {
    console.error('Error fetching latest scans:', err);
    res.status(500).json({ message: 'Failed to retrieve latest scans.' });
  }
};

exports.runQuickScan = async (req, res) => {
  const io = req.app.get('io');

  try {
    progressTracker.reset();
    const assets = await Asset.find();
    const allLogs = [];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const percent = Math.round(((i + 1) / assets.length) * 100);
      const message = `Scanning ${asset.name}`;
      progressTracker.setProgress(percent, message);

      if (io) io.emit('scanProgress', { percent, message, active: true });

      const scanResults = await runNmapScan(asset.ip);

      // Save each scan result
      for (const result of scanResults) {
        const scan = await ScanResult.create({
          ...result,
          asset: asset._id,
        });

        const vulnerabilityIds = [];

        for (const vulnTitle of result.vulnerabilities || []) {
          const vuln = await Vulnerability.findOneAndUpdate(
            { title: vulnTitle, asset: asset._id },
            {
              title: vulnTitle,
              severity: 'Medium',
              description: vulnTitle,
              asset: asset._id,
              scanResult: scan._id,
            },
            { upsert: true, new: true }
          );

          vulnerabilityIds.push(vuln._id);
        }

        scan.vulnerabilities = vulnerabilityIds;
        await scan.save();

        // ✅ Populate asset and vulnerabilities
        const populatedScan = await ScanResult.findById(scan._id)
          .populate('asset', 'name ip')
          .populate('vulnerabilities', 'title severity status');

        allLogs.push(populatedScan);
      }
    }

    progressTracker.complete();
    if (io) {
      io.emit('scanProgress', {
        percent: 100,
        message: 'Scan complete',
        active: false,
      });
    }

    res.json({ message: 'Quick scan finished.', logs: allLogs });
  } catch (err) {
    console.error('Quick scan error:', err);
    progressTracker.reset();
    if (io) {
      io.emit('scanProgress', {
        percent: 0,
        message: 'Scan failed',
        active: false,
      });
    }

    res.status(500).json({ message: 'Scan failed' });
  }
};

exports.getScanProgress = (req, res) => {
  res.json(progressTracker.getProgress());
};
