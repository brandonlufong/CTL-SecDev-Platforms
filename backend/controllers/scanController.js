const Asset = require('../models/Asset');
const NetworkDevice = require('../models/Device');
const ScanResult = require('../models/ScanResult');
const Vulnerability = require('../models/Vulnerability');
const { runNmapScan, runBatchScan, getScanStats, validateIP, pingTest } = require('../services/scannerService');
const progressTracker = require('../services/scanProgress');

/**
 * Enhanced Scan Controller with comprehensive vulnerability management
 */

exports.scanAsset = async (req, res) => {
  try {
    const { assetId, scanType = 'comprehensive' } = req.body;
    
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    if (!validateIP(asset.ip)) {
      return res.status(400).json({ message: 'Invalid IP address format' });
    }

    console.log(`Starting ${scanType} scan for asset: ${asset.name} (${asset.ip})`);

    const scanResults = await runNmapScan(asset.ip, {
      scanType,
      includeVulnScripts: true,
      onProgress: (percent, message) => {
        console.log(`Scan progress: ${percent}% - ${message}`);
      }
    });

    const savedResults = [];
    const createdVulnerabilities = [];

    for (const scanResult of scanResults) {
      const savedScanResult = await ScanResult.create({
        port: scanResult.port,
        protocol: scanResult.protocol,
        state: scanResult.state,
        service: scanResult.service,
        product: scanResult.product,
        version: scanResult.version,
        extraInfo: scanResult.extraInfo,
        cpe: scanResult.cpe,
        vulnerabilityScore: scanResult.vulnerabilityScore,
        confidence: scanResult.confidence,
        detectionMethods: scanResult.detectionMethods,
        scanEnhancement: scanResult.scanEnhancement,
        scannedAt: scanResult.scannedAt,
        asset: asset._id,
        vulnerabilities: []
      });

      if (scanResult.detectionDetails && scanResult.detectionDetails.length > 0) {
        const vulnerabilityIds = [];
        for (const vulnDetail of scanResult.detectionDetails) {
          try {
            let existingVuln = await Vulnerability.findOne({
              $or: [
                { cve: vulnDetail.cve, asset: asset._id },
                { title: vulnDetail.title, asset: asset._id }
              ]
            });

            if (existingVuln) {
              existingVuln.severity = vulnDetail.severity || existingVuln.severity;
              existingVuln.description = vulnDetail.description || existingVuln.description;
              existingVuln.cvssScore = vulnDetail.cvssScore || existingVuln.cvssScore;
              existingVuln.remediation = vulnDetail.remediation || existingVuln.remediation;
              existingVuln.exploitAvailable = vulnDetail.exploitAvailable !== undefined ? vulnDetail.exploitAvailable : existingVuln.exploitAvailable;
              existingVuln.references = vulnDetail.references || existingVuln.references;
              existingVuln.discoveredDate = new Date();
              existingVuln.scanResult = savedScanResult._id;
              if (existingVuln.status === 'Resolved' || existingVuln.status === 'Closed') {
                existingVuln.status = 'Open';
              }
              await existingVuln.save();
              vulnerabilityIds.push(existingVuln._id);
              console.log(`Updated existing vulnerability: ${existingVuln.title}`);
            } else {
              const newVuln = await Vulnerability.create({
                title: vulnDetail.title || `${vulnDetail.cve} - ${scanResult.service} vulnerability`,
                cve: vulnDetail.cve || null,
                severity: vulnDetail.severity || 'Medium',
                description: vulnDetail.description || 'Vulnerability detected during automated scan',
                cvssScore: vulnDetail.cvssScore || 0,
                remediation: vulnDetail.remediation || 'Review vulnerability details and apply appropriate patches',
                exploitAvailable: vulnDetail.exploitAvailable || false,
                references: vulnDetail.references || [],
                discoveredDate: new Date(),
                status: 'Open',
                asset: asset._id,
                scanResult: savedScanResult._id,
                cpeMatch: scanResult.cpe,
                affectedProducts: scanResult.product ? [scanResult.product] : []
              });
              vulnerabilityIds.push(newVuln._id);
              createdVulnerabilities.push(newVuln);
              console.log(`Created new vulnerability: ${newVuln.title}`);
            }
          } catch (error) {
            console.error(`Error processing vulnerability ${vulnDetail.title}:`, error);
          }
        }
        savedScanResult.vulnerabilities = vulnerabilityIds;
        await savedScanResult.save();
      }

      const populatedScanResult = await ScanResult.findById(savedScanResult._id)
        .populate('asset', 'name ip type')
        .populate('vulnerabilities', 'title cve severity cvssScore status');

      savedResults.push(populatedScanResult);
    }

    asset.lastScanDate = new Date();
    await asset.save();

    const response = {
      success: true,
      message: `Scan completed for asset: ${asset.name}`,
      asset: {
        id: asset._id,
        name: asset.name,
        ip: asset.ip,
        type: asset.type
      },
      scanSummary: {
        totalPorts: scanResults.length,
        openPorts: scanResults.filter(r => r.state === 'open').length,
        totalVulnerabilities: createdVulnerabilities.length,
        highestSeverity: getHighestSeverity(createdVulnerabilities),
        riskLevel: calculateOverallRisk(scanResults)
      },
      scanResults: savedResults,
      newVulnerabilities: createdVulnerabilities.length
    };

    res.json(response);
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Scan failed', 
      error: error.message 
    });
  }
};

exports.scanDevice = async (req, res) => {
  try {
    const { deviceId, scanType = 'comprehensive' } = req.body;

    const device = await NetworkDevice.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (!validateIP(device.ip)) {
      return res.status(400).json({ message: 'Invalid IP address format' });
    }

    console.log(`Starting ${scanType} scan for device: ${device.name} (${device.ip})`);

    const scanResults = await runNmapScan(device.ip, {
      scanType,
      includeVulnScripts: true,
      onProgress: (percent, message) => {
        console.log(`Scan progress: ${percent}% - ${message}`);
      }
    });

    const savedResults = [];
    const createdVulnerabilities = [];

    for (const scanResult of scanResults) {
      const savedScanResult = await ScanResult.create({
        port: scanResult.port,
        protocol: scanResult.protocol,
        state: scanResult.state,
        service: scanResult.service,
        product: scanResult.product,
        version: scanResult.version,
        extraInfo: scanResult.extraInfo,
        cpe: scanResult.cpe,
        vulnerabilityScore: scanResult.vulnerabilityScore,
        confidence: scanResult.confidence,
        detectionMethods: scanResult.detectionMethods,
        scanEnhancement: scanResult.scanEnhancement,
        scannedAt: scanResult.scannedAt,
        device: device._id,
        vulnerabilities: []
      });

      if (scanResult.detectionDetails && scanResult.detectionDetails.length > 0) {
        const vulnerabilityIds = [];
        for (const vulnDetail of scanResult.detectionDetails) {
          try {
            let existingVuln = await Vulnerability.findOne({
              $or: [
                { cve: vulnDetail.cve, device: device._id },
                { title: vulnDetail.title, device: device._id }
              ]
            });

            if (existingVuln) {
              existingVuln.severity = vulnDetail.severity || existingVuln.severity;
              existingVuln.description = vulnDetail.description || existingVuln.description;
              existingVuln.cvssScore = vulnDetail.cvssScore || existingVuln.cvssScore;
              existingVuln.remediation = vulnDetail.remediation || existingVuln.remediation;
              existingVuln.exploitAvailable = vulnDetail.exploitAvailable !== undefined ? vulnDetail.exploitAvailable : existingVuln.exploitAvailable;
              existingVuln.references = vulnDetail.references || existingVuln.references;
              existingVuln.discoveredDate = new Date();
              existingVuln.scanResult = savedScanResult._id;
              if (existingVuln.status === 'Resolved' || existingVuln.status === 'Closed') {
                existingVuln.status = 'Open';
              }
              await existingVuln.save();
              vulnerabilityIds.push(existingVuln._id);
              console.log(`Updated existing vulnerability: ${existingVuln.title}`);
            } else {
              const newVuln = await Vulnerability.create({
                title: vulnDetail.title || `${vulnDetail.cve} - ${scanResult.service} vulnerability`,
                cve: vulnDetail.cve || null,
                severity: vulnDetail.severity || 'Medium',
                description: vulnDetail.description || 'Vulnerability detected during automated scan',
                cvssScore: vulnDetail.cvssScore || 0,
                remediation: vulnDetail.remediation || 'Review vulnerability details and apply appropriate patches',
                exploitAvailable: vulnDetail.exploitAvailable || false,
                references: vulnDetail.references || [],
                discoveredDate: new Date(),
                status: 'Open',
                // asset: asset._id,
                device: device._id,
                scanResult: savedScanResult._id,
                cpeMatch: scanResult.cpe,
                affectedProducts: scanResult.product ? [scanResult.product] : []
              });
              vulnerabilityIds.push(newVuln._id);
              createdVulnerabilities.push(newVuln);
              console.log(`Created new vulnerability: ${newVuln.title}`);
            }
          } catch (error) {
            console.error(`Error processing vulnerability ${vulnDetail.title}:`, error);
          }
        }
        savedScanResult.vulnerabilities = vulnerabilityIds;
        await savedScanResult.save();
      }

      const populatedScanResult = await ScanResult.findById(savedScanResult._id)
        .populate('device', 'name ip')
        .populate('vulnerabilities', 'title cve severity cvssScore status');

      savedResults.push(populatedScanResult);
    }

    device.lastScanDate = new Date();
    await device.save();

    const response = {
      success: true,
      message: `Scan completed for device: ${device.name}`,
      device: {
        id: device._id,
        name: device.name,
        ip: device.ip,
        type: device.type
      },
      scanSummary: {
        totalPorts: scanResults.length,
        openPorts: scanResults.filter(r => r.state === 'open').length,
        totalVulnerabilities: createdVulnerabilities.length,
        highestSeverity: getHighestSeverity(createdVulnerabilities),
        riskLevel: calculateOverallRisk(scanResults)
      },
      scanResults: savedResults,
      newVulnerabilities: createdVulnerabilities.length
    };

    res.json(response);
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Scan failed', 
      error: error.message 
    });
  }
};

exports.runQuickScan = async (req, res) => {
  const io = req.app.get('io');
  try {
    const { scanType = 'quick' } = req.body || {};
    progressTracker.reset();
    const assets = await Asset.find({ status: 'Online' });
    if (assets.length === 0) {
      return res.status(400).json({ message: 'No online assets found to scan' });
    }

    const allResults = [];
    const allVulnerabilities = [];
    let totalScanned = 0;

    console.log(`Starting ${scanType} scan for ${assets.length} assets`);

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const percent = Math.round(((i + 1) / assets.length) * 100);
      const message = `Scanning ${asset.name} (${asset.ip})`;
      progressTracker.setProgress(percent, message);
      if (io) io.emit('scanProgress', { percent, message, active: true });

      try {
        const isReachable = await pingTest(asset.ip);
        if (!isReachable) {
          console.log(`Asset ${asset.name} (${asset.ip}) is not reachable, skipping...`);
          continue;
        }

        const scanResults = await runNmapScan(asset.ip, {
          scanType,
          includeVulnScripts: true
        });

        for (const scanResult of scanResults) {
          const savedScanResult = await ScanResult.create({
            ...scanResult,
            asset: asset._id,
            vulnerabilities: []
          });

          if (scanResult.detectionDetails && scanResult.detectionDetails.length > 0) {
            const vulnerabilityIds = [];
            for (const vulnDetail of scanResult.detectionDetails) {
              try {
                const existingVuln = await Vulnerability.findOne({
                  $or: [
                    { cve: vulnDetail.cve, asset: asset._id },
                    { title: vulnDetail.title, asset: asset._id }
                  ]
                });

                let vulnerability;
                if (existingVuln) {
                  existingVuln.discoveredDate = new Date();
                  existingVuln.scanResult = savedScanResult._id;
                  if (existingVuln.status === 'Resolved') {
                    existingVuln.status = 'Open';
                  }
                  await existingVuln.save();
                  vulnerability = existingVuln;
                } else {
                  vulnerability = await Vulnerability.create({
                    title: vulnDetail.title || `${vulnDetail.cve} - ${scanResult.service} vulnerability`,
                    cve: vulnDetail.cve || null,
                    severity: vulnDetail.severity || 'Medium',
                    description: vulnDetail.description || 'Vulnerability detected during quick scan',
                    cvssScore: vulnDetail.cvssScore || 0,
                    remediation: vulnDetail.remediation || 'Review and apply security patches',
                    exploitAvailable: vulnDetail.exploitAvailable || false,
                    references: vulnDetail.references || [],
                    discoveredDate: new Date(),
                    status: 'Open',
                    asset: asset._id,
                    scanResult: savedScanResult._id
                  });
                  allVulnerabilities.push(vulnerability);
                }

                vulnerabilityIds.push(vulnerability._id);
              } catch (error) {
                console.error(`Error processing vulnerability in quick scan:`, error);
              }
            }
            savedScanResult.vulnerabilities = vulnerabilityIds;
            await savedScanResult.save();
          }
          allResults.push(savedScanResult);
        }

        asset.lastScanDate = new Date();
        await asset.save();
        totalScanned++;
      } catch (error) {
        console.error(`Error scanning asset ${asset.name}:`, error);
      }
    }

    progressTracker.complete();
    if (io) {
      io.emit('scanProgress', {
        percent: 100,
        message: `Quick scan completed - ${totalScanned} assets scanned`,
        active: false
      });
    }

    const response = {
      success: true,
      message: `Quick scan completed for ${totalScanned} assets`,
      summary: {
        totalAssets: assets.length,
        scannedAssets: totalScanned,
        totalVulnerabilities: allVulnerabilities.length,
        newVulnerabilities: allVulnerabilities.length,
        highestSeverity: getHighestSeverity(allVulnerabilities)
      },
      results: allResults.slice(0, 10)
    };

    res.json(response);
  } catch (error) {
    console.error('Quick scan error:', error);
    progressTracker.reset();
    if (io) {
      io.emit('scanProgress', {
        percent: 0,
        message: 'Quick scan failed',
        active: false
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Quick scan failed', 
      error: error.message 
    });
  }
};

exports.getLatestScans = async (req, res) => {
  try {
    const { limit = 10, assetId } = req.query;
    const filter = assetId ? { asset: assetId } : {};
    const latestScans = await ScanResult.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('asset', 'name ip type')
      .populate('vulnerabilities', 'title cve severity cvssScore status');

    res.json({
      success: true,
      scans: latestScans,
      total: latestScans.length
    });
  } catch (error) {
    console.error('Error fetching latest scans:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to retrieve latest scans',
      error: error.message 
    });
  }
};

exports.getScanProgress = (req, res) => {
  try {
    const progress = progressTracker.getProgress();
    const stats = getScanStats();
    res.json({
      success: true,
      progress,
      stats
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to get scan progress',
      error: error.message 
    });
  }
};

exports.testConnectivity = async (req, res) => {
  try {
    const { assetId } = req.params;
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    const isReachable = await pingTest(asset.ip);
    res.json({
      success: true,
      asset: {
        id: asset._id,
        name: asset.name,
        ip: asset.ip
      },
      reachable: isReachable,
      testedAt: new Date()
    });
  } catch (error) {
    console.error('Connectivity test error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Connectivity test failed',
      error: error.message 
    });
  }
};

exports.runBatchScan = async (req, res) => {
  try {
    const { assetIds, scanType = 'quick' } = req.body;
    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ message: 'Asset IDs array is required' });
    }

    const assets = await Asset.find({ _id: { $in: assetIds } });
    if (assets.length === 0) {
      return res.status(404).json({ message: 'No valid assets found' });
    }

    const ipList = assets.map(asset => asset.ip);
    console.log(`Starting batch scan for ${assets.length} assets`);

    const { results, errors } = await runBatchScan(ipList, {
      scanType,
      maxConcurrent: 2,
      onProgress: (percent, message) => {
        console.log(`Batch scan progress: ${percent}% - ${message}`);
      }
    });

    const processedResults = [];
    for (const result of results) {
      const asset = assets.find(a => a.ip === result.ip);
      if (asset && result.result) {
        for (const scanResult of result.result) {
          const savedScanResult = await ScanResult.create({
            ...scanResult,
            asset: asset._id
          });
          processedResults.push(savedScanResult);
        }
      }
    }

    res.json({
      success: true,
      message: `Batch scan completed`,
      summary: {
        totalAssets: assets.length,
        successfulScans: results.length,
        failedScans: errors.length,
        totalResults: processedResults.length
      },
      results: processedResults,
      errors: errors
    });
  } catch (error) {
    console.error('Batch scan error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Batch scan failed',
      error: error.message 
    });
  }
};

function getHighestSeverity(vulnerabilities) {
  if (!vulnerabilities || vulnerabilities.length === 0) return 'None';
  const severityOrder = ['Critical', 'High', 'Medium', 'Low', 'Informational'];
  for (const severity of severityOrder) {
    if (vulnerabilities.some(v => v.severity === severity)) {
      return severity;
    }
  }
  return 'Unknown';
}

function calculateOverallRisk(scanResults) {
  if (!scanResults || scanResults.length === 0) return 'Low';
  const maxScore = Math.max(...scanResults.map(r => r.vulnerabilityScore || 0));
  if (maxScore >= 9.0) return 'Critical';
  if (maxScore >= 7.0) return 'High';
  if (maxScore >= 4.0) return 'Medium';
  return 'Low';
}
