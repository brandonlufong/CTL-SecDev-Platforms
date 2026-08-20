const Asset = require('../models/Asset');
const NetworkDevice = require('../models/Device');
const ScanResult = require('../models/ScanResult');
const Vulnerability = require('../models/Vulnerability');
const { runNmapScan, runBatchScan, getScanStats, validateIP, pingTest, enhancedConnectivityTest } = require('../services/scannerService');
const progressTracker = require('../services/scanProgress');
const { criticalityFactor } = require('../utils/risk');
const enrichmentQueue = require('../services/enrichmentQueue');
const { tagsFor } = require('../utils/compliance');
const scanEngines = require('../services/scanEngines');

// GET /api/scan/engines — which scan engines are available (nmap always; Nessus/
// OpenVAS only when configured). Drives the engine picker in the UI.
exports.getEngines = (req, res) => {
  try { res.json({ engines: scanEngines.engineConfig() }); }
  catch (err) { res.status(500).json({ message: 'Failed to read engines', error: err.message }); }
};

// Run an optional engine (nessus/openvas) against a target and persist findings.
// Returns a response object on success, or throws so the caller can fall back.
async function runEngineScan(engine, target, targetType) {
  progressTracker.startScan(1, `Starting ${engine} scan for ${target.name}`);
  const findings = await scanEngines.runEngine(engine, target.ip, {
    onProgress: (p, m) => progressTracker.setProgress(p, m, { [`current${targetType === 'asset' ? 'Asset' : 'Device'}`]: target.name }),
  });
  progressTracker.setProgress(85, 'Saving findings...');
  const { created, updated } = await scanEngines.persistFindings(findings, target, targetType);
  target.lastScanDate = new Date();
  await target.save();
  progressTracker.complete(`${engine} scan completed for ${target.name}`);
  return {
    success: true, engine,
    message: `${engine} scan completed for ${target.name}`,
    [targetType]: { id: target._id, name: target.name, ip: target.ip },
    scanSummary: { totalFindings: findings.length, newVulnerabilities: created, updatedVulnerabilities: updated },
    newVulnerabilities: created,
  };
}

/**
 * Weight a scan's freshly-saved vulnerabilities by the target asset/device
 * criticality, and refresh the target's detected-software fingerprint. Applied
 * once per scan against the base riskScore, so it never compounds.
 */
async function applyCriticalityAndSoftware(target, targetField, savedResults, scanResults) {
  const ids = savedResults.flatMap(sr => (sr.vulnerabilities || []).map(v => v._id)).filter(Boolean);
  if (ids.length) {
    const f = criticalityFactor(target.criticality);
    await Vulnerability.updateMany(
      { _id: { $in: ids } },
      [{ $set: { riskScore: { $round: [{ $min: [10, { $multiply: [{ $ifNull: ['$riskScore', 0] }, f] }] }, 1] } } }]
    );
    // Refresh EPSS/KEV asynchronously so the scan response isn't blocked on APIs.
    enrichmentQueue.enqueue(ids);
  }
  target.detectedSoftware = (scanResults || [])
    .filter(r => r.state === 'open')
    .map(r => ({
      port: r.port, protocol: r.protocol, service: r.service,
      product: r.product, version: r.version, cpe: r.cpe, lastSeen: new Date()
    }));
}

/**
 * Enhanced Scan Controller with comprehensive vulnerability management
 */

exports.scanAsset = async (req, res) => {
  try {
    const { assetId, scanType = 'comprehensive', engine = 'nmap', fallback = true } = req.body;

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    if (!validateIP(asset.ip)) {
      return res.status(400).json({ message: 'Invalid IP address format' });
    }

    // Optional engine (Nessus/OpenVAS). Falls back to nmap on failure unless disabled.
    if (engine && engine !== 'nmap') {
      try {
        return res.json(await runEngineScan(engine, asset, 'asset'));
      } catch (e) {
        console.warn(`[scan] ${engine} failed for ${asset.ip}: ${e.message}`);
        if (!fallback) { progressTracker.setError(`${engine}: ${e.message}`); return res.status(502).json({ success: false, engine, message: `${engine} scan failed`, error: e.message }); }
        console.warn('[scan] falling back to nmap');
      }
    }

    console.log(`Starting ${scanType} scan for asset: ${asset.name} (${asset.ip})`);
    
    // Initialize progress tracking
    progressTracker.startScan(1, `Initializing scan for ${asset.name}`);

    const scanResults = await runNmapScan(asset.ip, {
      scanType,
      includeVulnScripts: true,
      onProgress: (percent, message) => {
        // Forward progress to the tracker which will emit via Socket.IO
        progressTracker.setProgress(percent, message, {
          currentAsset: asset.name,
          assetId: asset._id
        });
      }
    });

    // Process results with progress updates
    const savedResults = [];
    const createdVulnerabilities = [];
    
    progressTracker.setProgress(85, 'Saving scan results...');

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
              existingVuln.epssScore = vulnDetail.epssScore ?? existingVuln.epssScore;
              existingVuln.knownExploited = vulnDetail.knownExploited ?? existingVuln.knownExploited;
              existingVuln.riskScore = vulnDetail.riskScore || existingVuln.riskScore;
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
            } else {
              const newVuln = await Vulnerability.create({
                title: vulnDetail.title || `${vulnDetail.cve} - ${scanResult.service} vulnerability`,
                cve: vulnDetail.cve || null,
                severity: vulnDetail.severity || 'Medium',
                description: vulnDetail.description || 'Vulnerability detected during automated scan',
                cvssScore: vulnDetail.cvssScore || 0,
                epssScore: vulnDetail.epssScore ?? null,
                knownExploited: vulnDetail.knownExploited || false,
                riskScore: vulnDetail.riskScore || 0,
                remediation: vulnDetail.remediation || 'Review vulnerability details and apply appropriate patches',
                exploitAvailable: vulnDetail.exploitAvailable || false,
                references: vulnDetail.references || [],
                discoveredDate: new Date(),
                status: 'Open',
                asset: asset._id,
                scanResult: savedScanResult._id,
                cpeMatch: scanResult.cpe,
                affectedProducts: scanResult.product ? [scanResult.product] : [],
                complianceTags: tagsFor({ service: scanResult.service, port: scanResult.port, severity: vulnDetail.severity, knownExploited: vulnDetail.knownExploited, exploitAvailable: vulnDetail.exploitAvailable, title: vulnDetail.title })
              });
              vulnerabilityIds.push(newVuln._id);
              createdVulnerabilities.push(newVuln);
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

    await applyCriticalityAndSoftware(asset, 'asset', savedResults, scanResults);
    asset.lastScanDate = new Date();
    await asset.save();

    // Complete the scan
    progressTracker.complete(`Scan completed for ${asset.name}`);

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
    progressTracker.setError(`Scan failed: ${error.message}`);
    res.status(500).json({ 
      success: false,
      message: 'Scan failed', 
      error: error.message 
    });
  }
};

exports.scanDevice = async (req, res) => {
  try {
    const { deviceId, scanType = 'comprehensive', engine = 'nmap', fallback = true } = req.body;

    const device = await NetworkDevice.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (!validateIP(device.ip)) {
      return res.status(400).json({ message: 'Invalid IP address format' });
    }

    if (engine && engine !== 'nmap') {
      try {
        return res.json(await runEngineScan(engine, device, 'device'));
      } catch (e) {
        console.warn(`[scan] ${engine} failed for ${device.ip}: ${e.message}`);
        if (!fallback) { progressTracker.setError(`${engine}: ${e.message}`); return res.status(502).json({ success: false, engine, message: `${engine} scan failed`, error: e.message }); }
        console.warn('[scan] falling back to nmap');
      }
    }

    console.log(`Starting ${scanType} scan for device: ${device.name} (${device.ip})`);

    // Initialize progress tracking
    progressTracker.startScan(1, `Initializing scan for ${device.name}`);

    const scanResults = await runNmapScan(device.ip, {
      scanType,
      includeVulnScripts: true,
      onProgress: (percent, message) => {
        // Forward progress to the tracker which will emit via Socket.IO
        progressTracker.setProgress(percent, message, {
          currentDevice: device.name,
          deviceId: device._id
        });
      }
    });

    // Process results with progress updates
    const savedResults = [];
    const createdVulnerabilities = [];

    progressTracker.setProgress(85, 'Saving scan results...');

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
              existingVuln.epssScore = vulnDetail.epssScore ?? existingVuln.epssScore;
              existingVuln.knownExploited = vulnDetail.knownExploited ?? existingVuln.knownExploited;
              existingVuln.riskScore = vulnDetail.riskScore || existingVuln.riskScore;
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
                epssScore: vulnDetail.epssScore ?? null,
                knownExploited: vulnDetail.knownExploited || false,
                riskScore: vulnDetail.riskScore || 0,
                remediation: vulnDetail.remediation || 'Review vulnerability details and apply appropriate patches',
                exploitAvailable: vulnDetail.exploitAvailable || false,
                references: vulnDetail.references || [],
                discoveredDate: new Date(),
                status: 'Open',
                // asset: asset._id,
                device: device._id,
                scanResult: savedScanResult._id,
                cpeMatch: scanResult.cpe,
                affectedProducts: scanResult.product ? [scanResult.product] : [],
                complianceTags: tagsFor({ service: scanResult.service, port: scanResult.port, severity: vulnDetail.severity, knownExploited: vulnDetail.knownExploited, exploitAvailable: vulnDetail.exploitAvailable, title: vulnDetail.title })
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

    await applyCriticalityAndSoftware(device, 'device', savedResults, scanResults);
    device.lastScanDate = new Date();
    await device.save();

    // Complete the scan
    progressTracker.complete(`Scan completed for ${device.name}`);

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

// exports.runQuickScan = async (req, res) => {
//   try {
//     const { scanType = 'quick' } = req.body || {};
    
//     // Fetch both assets and devices
//     const assets = await Asset.find({ status: 'Online' });
//     const devices = await NetworkDevice.find({ status: 'Online' }); // Add Device model query
    
//     // Combine both into a single array with a type indicator
//     const allTargets = [
//       ...assets.map(a => ({ ...a.toObject(), targetType: 'asset', model: Asset })),
//       ...devices.map(d => ({ ...d.toObject(), targetType: 'device', model: NetworkDevice }))
//     ];
    
//     if (allTargets.length === 0) {
//       return res.status(400).json({ message: 'No online assets or devices found to scan' });
//     }

//     const allResults = [];
//     const allVulnerabilities = [];
//     let totalScanned = 0;

//     console.log(`Starting ${scanType} scan for ${allTargets.length} targets (${assets.length} assets, ${devices.length} devices)`);
    
//     // Initialize batch scan progress
//     progressTracker.startScan(allTargets.length, `Starting quick scan of ${allTargets.length} targets`);

//     for (let i = 0; i < allTargets.length; i++) {
//       const target = allTargets[i];
      
//       // Update batch progress
//       progressTracker.updateBatchProgress(i, target.name);

//       try {
//         const isReachable = await pingTest(target.ip);
//         if (!isReachable) {
//           console.log(`Target ${target.name} (${target.ip}) is not reachable, skipping...`);
//           continue;
//         }

//         const scanResults = await runNmapScan(target.ip, {
//           scanType,
//           includeVulnScripts: true,
//           onProgress: (percent, message) => {
//             // Calculate overall progress: completed targets + current target progress
//             const overallPercent = Math.floor(
//               ((i + (percent / 100)) / allTargets.length) * 100
//             );
//             progressTracker.setProgress(
//               overallPercent, 
//               `${target.name}: ${message}`,
//               { currentTarget: target.name, completedTargets: i }
//             );
//           }
//         });

//         for (const scanResult of scanResults) {
//           // Reference the appropriate model based on target type
//           const targetRef = target.targetType === 'asset' 
//             ? { asset: target._id } 
//             : { device: target._id };
            
//           const savedScanResult = await ScanResult.create({
//             ...scanResult,
//             ...targetRef,
//             vulnerabilities: []
//           });

//           if (scanResult.detectionDetails && scanResult.detectionDetails.length > 0) {
//             const vulnerabilityIds = [];
//             for (const vulnDetail of scanResult.detectionDetails) {
//               try {
//                 // Check for existing vulnerability on this specific target
//                 const existingVuln = await Vulnerability.findOne({
//                   $and: [
//                     {
//                       $or: [
//                         { cve: vulnDetail.cve },
//                         { title: vulnDetail.title }
//                       ]
//                     },
//                     target.targetType === 'asset' 
//                       ? { asset: target._id }
//                       : { device: target._id }
//                   ]
//                 });

//                 let vulnerability;
//                 if (existingVuln) {
//                   existingVuln.discoveredDate = new Date();
//                   existingVuln.scanResult = savedScanResult._id;
//                   if (existingVuln.status === 'Resolved') {
//                     existingVuln.status = 'Open';
//                   }
//                   await existingVuln.save();
//                   vulnerability = existingVuln;
//                 } else {
//                   vulnerability = await Vulnerability.create({
//                     title: vulnDetail.title || `${vulnDetail.cve} - ${scanResult.service} vulnerability`,
//                     cve: vulnDetail.cve || null,
//                     severity: vulnDetail.severity || 'Medium',
//                     description: vulnDetail.description || 'Vulnerability detected during quick scan',
//                     cvssScore: vulnDetail.cvssScore || 0,
//                     remediation: vulnDetail.remediation || 'Review and apply security patches',
//                     exploitAvailable: vulnDetail.exploitAvailable || false,
//                     references: vulnDetail.references || [],
//                     discoveredDate: new Date(),
//                     status: 'Open',
//                     ...(target.targetType === 'asset' 
//                       ? { asset: target._id } 
//                       : { device: target._id }),
//                     scanResult: savedScanResult._id
//                   });
//                   allVulnerabilities.push(vulnerability);
//                 }

//                 vulnerabilityIds.push(vulnerability._id);
//               } catch (error) {
//                 console.error(`Error processing vulnerability in quick scan:`, error);
//               }
//             }
//             savedScanResult.vulnerabilities = vulnerabilityIds;
//             await savedScanResult.save();
//           }
//           allResults.push(savedScanResult);
//         }

//         // Update lastScanDate on the appropriate model
//         if (target.targetType === 'asset') {
//           await Asset.findByIdAndUpdate(target._id, { lastScanDate: new Date() });
//         } else {
//           await Device.findByIdAndUpdate(target._id, { lastScanDate: new Date() });
//         }
        
//         totalScanned++;
//       } catch (error) {
//         console.error(`Error scanning target ${target.name}:`, error);
//       }
//     }

//     // Complete the scan
//     progressTracker.complete(`Quick scan completed - ${totalScanned}/${allTargets.length} targets scanned`);

//     const response = {
//       success: true,
//       message: `Quick scan completed for ${totalScanned} targets`,
//       summary: {
//         totalTargets: allTargets.length,
//         totalAssets: assets.length,
//         totalDevices: devices.length,
//         scannedTargets: totalScanned,
//         totalVulnerabilities: allVulnerabilities.length,
//         newVulnerabilities: allVulnerabilities.length,
//         highestSeverity: getHighestSeverity(allVulnerabilities)
//       },
//       results: allResults.slice(0, 10)
//     };

//     res.json(response);
//   } catch (error) {
//     console.error('Quick scan error:', error);
//     progressTracker.setError(`Quick scan failed: ${error.message}`);

//     res.status(500).json({ 
//       success: false,
//       message: 'Quick scan failed', 
//       error: error.message 
//     });
//   }
// };

// exports.runQuickScan = async (req, res) => {
//   try {
//     const { scanType = 'quick' } = req.body || {};
//     progressTracker.reset();
    
//     const assets = await Asset.find({ status: 'Online' });
//     const devices = await NetworkDevice.find({ status: 'Online' });
    
//     const allTargets = [
//       ...assets.map(a => ({ ...a.toObject(), targetType: 'asset' })),
//       ...devices.map(d => ({ ...d.toObject(), targetType: 'device' }))
//     ];
    
//     if (allTargets.length === 0) {
//       return res.status(400).json({ message: 'No online assets or devices found to scan' });
//     }

//     const allResults = [];
//     const allVulnerabilities = [];
//     let totalScanned = 0;

//     console.log(`Starting ${scanType} scan for ${allTargets.length} targets`);
    
//     // Start progress tracking
//     progressTracker.setProgress(0, `Starting scan of ${allTargets.length} targets...`, {
//       totalAssets: allTargets.length,
//       completedAssets: 0
//     });

//     for (let i = 0; i < allTargets.length; i++) {
//       const target = allTargets[i];
      
//       // Update progress for current target
//       const percent = Math.round(((i) / allTargets.length) * 100);
//       progressTracker.setProgress(
//         percent, 
//         `Scanning ${target.name} (${target.ip})...`,
//         {
//           currentAsset: target.name,
//           completedAssets: i,
//           totalAssets: allTargets.length
//         }
//       );

//       try {
//         const isReachable = await pingTest(target.ip);
//         if (!isReachable) {
//           console.log(`Target ${target.name} is not reachable, skipping...`);
//           continue;
//         }

//         const scanResults = await runNmapScan(target.ip, {
//           scanType,
//           includeVulnScripts: true
//         });

//         // ... rest of your scan processing logic ...
        
//         totalScanned++;
//       } catch (error) {
//         console.error(`Error scanning target ${target.name}:`, error);
//       }
//     }

//     // Complete the scan
//     progressTracker.complete(`Quick scan completed - ${totalScanned}/${allTargets.length} targets scanned`);

//     const response = {
//       success: true,
//       message: `Quick scan completed for ${totalScanned} targets`,
//       summary: {
//         totalTargets: allTargets.length,
//         totalAssets: assets.length,
//         totalDevices: devices.length,
//         scannedTargets: totalScanned,
//         totalVulnerabilities: allVulnerabilities.length,
//         newVulnerabilities: allVulnerabilities.length
//       },
//       results: allResults.slice(0, 10)
//     };

//     res.json(response);
//   } catch (error) {
//     console.error('Quick scan error:', error);
//     progressTracker.setError(`Quick scan failed: ${error.message}`);

//     res.status(500).json({ 
//       success: false,
//       message: 'Quick scan failed', 
//       error: error.message 
//     });
//   }
// };

// Replace your runQuickScan function with this updated version

exports.runQuickScan = async (req, res) => {
  try {
    const { scanType = 'quick' } = req.body || {};
    
    // Reset progress tracker
    progressTracker.reset();
    
    const assets = await Asset.find({ status: 'Online' });
    const devices = await NetworkDevice.find({ status: 'Online' });
    
    const allTargets = [
      ...assets.map(a => ({ ...a.toObject(), targetType: 'asset' })),
      ...devices.map(d => ({ ...d.toObject(), targetType: 'device' }))
    ];
    
    if (allTargets.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No online assets or devices found to scan' 
      });
    }

    console.log(`Starting ${scanType} scan for ${allTargets.length} targets`);
    
    // Send immediate response that scan has started
    res.json({
      success: true,
      status: 'started',
      message: `Quick scan initiated for ${allTargets.length} targets. Progress will be sent via websocket.`,
      summary: {
        totalTargets: allTargets.length,
        totalAssets: assets.length,
        totalDevices: devices.length
      }
    });

    // Continue scanning asynchronously
    (async () => {
      const allResults = [];
      const allVulnerabilities = [];
      let totalScanned = 0;

      // Start progress tracking
      progressTracker.setProgress(0, `Starting scan of ${allTargets.length} targets...`, {
        totalAssets: allTargets.length,
        completedAssets: 0
      });

      for (let i = 0; i < allTargets.length; i++) {
        const target = allTargets[i];
        
        // Update progress for current target
        const percent = Math.round(((i) / allTargets.length) * 100);
        progressTracker.setProgress(
          percent, 
          `Scanning ${target.name} (${target.ip})...`,
          {
            currentAsset: target.name,
            completedAssets: i,
            totalAssets: allTargets.length
          }
        );

        try {
          const isReachable = await pingTest(target.ip);
          if (!isReachable) {
            console.log(`Target ${target.name} is not reachable, skipping...`);
            continue;
          }

          const scanResults = await runNmapScan(target.ip, {
            scanType,
            includeVulnScripts: true
          });

          // Process scan results
          for (const scanResult of scanResults) {
            const targetRef = target.targetType === 'asset' 
              ? { asset: target._id } 
              : { device: target._id };
              
            const savedScanResult = await ScanResult.create({
              ...scanResult,
              ...targetRef,
              vulnerabilities: []
            });

            if (scanResult.detectionDetails && scanResult.detectionDetails.length > 0) {
              const vulnerabilityIds = [];
              
              for (const vulnDetail of scanResult.detectionDetails) {
                try {
                  const existingVuln = await Vulnerability.findOne({
                    $and: [
                      {
                        $or: [
                          { cve: vulnDetail.cve },
                          { title: vulnDetail.title }
                        ]
                      },
                      target.targetType === 'asset' 
                        ? { asset: target._id }
                        : { device: target._id }
                    ]
                  });

                  let vulnerability;
                  if (existingVuln) {
                    existingVuln.discoveredDate = new Date();
                    existingVuln.scanResult = savedScanResult._id;
                    if (existingVuln.status === 'Resolved' || existingVuln.status === 'Closed') {
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
                      epssScore: vulnDetail.epssScore ?? null,
                      knownExploited: vulnDetail.knownExploited || false,
                      riskScore: vulnDetail.riskScore || 0,
                      remediation: vulnDetail.remediation || 'Review and apply security patches',
                      exploitAvailable: vulnDetail.exploitAvailable || false,
                      references: vulnDetail.references || [],
                      discoveredDate: new Date(),
                      status: 'Open',
                      ...(target.targetType === 'asset' 
                        ? { asset: target._id } 
                        : { device: target._id }),
                      scanResult: savedScanResult._id,
                      cpeMatch: scanResult.cpe,
                      affectedProducts: scanResult.product ? [scanResult.product] : [],
                complianceTags: tagsFor({ service: scanResult.service, port: scanResult.port, severity: vulnDetail.severity, knownExploited: vulnDetail.knownExploited, exploitAvailable: vulnDetail.exploitAvailable, title: vulnDetail.title })
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

          // Update lastScanDate
          if (target.targetType === 'asset') {
            await Asset.findByIdAndUpdate(target._id, { lastScanDate: new Date() });
          } else {
            await NetworkDevice.findByIdAndUpdate(target._id, { lastScanDate: new Date() });
          }
          
          totalScanned++;
        } catch (error) {
          console.error(`Error scanning target ${target.name}:`, error);
        }
      }

      // Complete the scan with final summary
      const summary = {
        totalTargets: allTargets.length,
        totalAssets: assets.length,
        totalDevices: devices.length,
        scannedTargets: totalScanned,
        totalVulnerabilities: allVulnerabilities.length,
        newVulnerabilities: allVulnerabilities.length,
        highestSeverity: getHighestSeverity(allVulnerabilities)
      };

      progressTracker.complete(
        `Quick scan completed - ${totalScanned}/${allTargets.length} targets scanned`,
        summary
      );

      console.log('Quick scan completed:', summary);
    })().catch(error => {
      console.error('Quick scan async error:', error);
      progressTracker.setError(`Quick scan failed: ${error.message}`);
    });

  } catch (error) {
    console.error('Quick scan initialization error:', error);
    progressTracker.setError(`Quick scan failed to start: ${error.message}`);

    res.status(500).json({ 
      success: false,
      message: 'Quick scan failed to start', 
      error: error.message 
    });
  }
};

exports.getLatestScans = async (req, res) => {
  try {
    const { limit = 10, assetId, deviceId } = req.query;
    
    // Build filter for either asset or device
    let filter = {};
    if (assetId) {
      filter.asset = assetId;
    } else if (deviceId) {
      filter.device = deviceId;
    }
    
    const latestScans = await ScanResult.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('asset', 'name ip type')        // Populate asset
      .populate('device', 'name ip type')       // Populate device - THIS WAS MISSING
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
  // try {
  //   const { assetId } = req.params;
  //   const asset = await Asset.findById(assetId);
  //   if (!asset) {
  //     return res.status(404).json({ message: 'Asset not found' });
  //   }
  //   const isReachable = await pingTest(asset.ip);
  //   res.json({
  //     success: true,
  //     asset: {
  //       id: asset._id,
  //       name: asset.name,
  //       ip: asset.ip
  //     },
  //     reachable: isReachable,
  //     testedAt: new Date()
  //   });
  // } catch (error) {
  //   console.error('Connectivity test error:', error);
  //   res.status(500).json({ 
  //     success: false,
  //     message: 'Connectivity test failed',
  //     error: error.message 
  //   });
  // }
  try {
    const { assetId } = req.params;
    
    // Try to find as asset first
    let target = await Asset.findById(assetId);
    let targetType = 'asset';
    
    // If not found as asset, try as device
    if (!target) {
      target = await NetworkDevice.findById(assetId);
      targetType = 'device';
    }
    
    if (!target) {
      return res.status(404).json({ 
        success: false,
        message: 'Target not found' 
      });
    }

    if (!validateIP(target.ip)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid IP address format' 
      });
    }

    console.log(`Testing connectivity for ${target.name} (${target.ip})...`);
    
    // Use enhanced connectivity test
    const connectivityResult = await enhancedConnectivityTest(target.ip);
    
    console.log(`Connectivity result for ${target.name}:`, connectivityResult);

    res.json({
      success: true,
      target: {
        id: target._id,
        name: target.name,
        ip: target.ip,
        type: targetType
      },
      reachable: connectivityResult.reachable,
      method: connectivityResult.method,
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

// Add this new endpoint for bulk connectivity testing
exports.testBulkConnectivity = async (req, res) => {
  try {
    const { targetIds } = req.body;
    
    if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Target IDs array is required' 
      });
    }

    console.log(`Testing connectivity for ${targetIds.length} targets...`);
    
    const results = [];
    
    for (const targetId of targetIds) {
      try {
        // Try asset first
        let target = await Asset.findById(targetId);
        let targetType = 'asset';
        
        if (!target) {
          target = await NetworkDevice.findById(targetId);
          targetType = 'device';
        }
        
        if (!target) {
          results.push({
            id: targetId,
            reachable: false,
            error: 'Target not found'
          });
          continue;
        }

        const connectivityResult = await enhancedConnectivityTest(target.ip);
        
        results.push({
          id: target._id,
          name: target.name,
          ip: target.ip,
          type: targetType,
          reachable: connectivityResult.reachable,
          method: connectivityResult.method,
          testedAt: new Date()
        });
      } catch (error) {
        results.push({
          id: targetId,
          reachable: false,
          error: error.message
        });
      }
    }

    const reachableCount = results.filter(r => r.reachable).length;
    
    res.json({
      success: true,
      summary: {
        total: targetIds.length,
        reachable: reachableCount,
        unreachable: targetIds.length - reachableCount
      },
      results
    });
  } catch (error) {
    console.error('Bulk connectivity test error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Bulk connectivity test failed',
      error: error.message 
    });
  }
};

// ===========================================================================
// Scan history + drift detection (compare a target's two most recent scans)
// ===========================================================================
const mongoose = require('mongoose');

function targetMatch(targetType, targetId) {
  const field = targetType === 'device' ? 'device' : 'asset';
  return { [field]: new mongoose.Types.ObjectId(String(targetId)) };
}
// Group a scan by minute; tolerant of docs missing createdAt (older rows).
const bucketKey = (d) => {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 16);
};
const rowTime = (r) => r.createdAt || r.scannedAt;

// GET /api/scan/history?targetType=asset&targetId=...
exports.getScanHistory = async (req, res) => {
  try {
    const { targetType, targetId } = req.query;
    if (!targetId) return res.status(400).json({ message: 'targetId is required' });

    const rows = await ScanResult.find(targetMatch(targetType, targetId))
      .sort({ createdAt: -1 }).limit(3000).lean();

    const groups = new Map();
    for (const r of rows) {
      const k = bucketKey(rowTime(r));
      if (!k) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const sessions = [...groups.entries()].map(([k, g]) => ({
      session: k,
      at: rowTime(g[0]),
      ports: g.length,
      openPorts: g.filter(r => r.state === 'open').length,
      services: [...new Set(g.filter(r => r.state === 'open').map(r => r.service))],
      vulnerabilities: g.reduce((s, r) => s + (r.vulnerabilities?.length || 0), 0),
    })).slice(0, 50);

    res.json({ targetType: targetType || 'asset', targetId, sessions });
  } catch (err) {
    res.status(500).json({ message: 'Failed to build scan history', error: err.message });
  }
};

// GET /api/scan/delta?targetType=asset&targetId=...  -> diff of the two latest scans
exports.getScanDelta = async (req, res) => {
  try {
    const { targetType, targetId } = req.query;
    if (!targetId) return res.status(400).json({ message: 'targetId is required' });

    const rows = await ScanResult.find(targetMatch(targetType, targetId))
      .sort({ createdAt: -1 }).limit(3000).lean();

    const groups = new Map();
    for (const r of rows) {
      const k = bucketKey(rowTime(r));
      if (!k) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const keys = [...groups.keys()];
    if (keys.length < 2) {
      return res.json({ message: 'Need at least two scans to compare', comparable: false });
    }
    const [curK, prevK] = keys;
    const cur = groups.get(curK), prev = groups.get(prevK);
    const openSet = (arr) => new Map(arr.filter(r => r.state === 'open').map(r => [`${r.port}/${r.protocol}`, r.service]));
    const curOpen = openSet(cur), prevOpen = openSet(prev);

    const newPorts = [...curOpen].filter(([p]) => !prevOpen.has(p)).map(([p, svc]) => ({ port: p, service: svc }));
    const closedPorts = [...prevOpen].filter(([p]) => !curOpen.has(p)).map(([p, svc]) => ({ port: p, service: svc }));

    res.json({
      comparable: true,
      current: { session: curK, at: rowTime(cur[0]), openPorts: curOpen.size },
      previous: { session: prevK, at: rowTime(prev[0]), openPorts: prevOpen.size },
      newPorts,
      closedPorts,
      drift: newPorts.length + closedPorts.length,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to build scan delta', error: err.message });
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
