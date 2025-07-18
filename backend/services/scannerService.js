// // services/scannerService.js
// const { exec } = require('child_process');

// const runNmapScan = (ip) => {
//   return new Promise((resolve, reject) => {
//     const cmd = `nmap -sV ${ip} -oX -`; // XML output
//     exec(cmd, { timeout: 15000 }, (err, stdout) => {
//       if (err) return reject(err);
//       resolve(stdout);
//     });
//   });
// };

// module.exports = { runNmapScan };
// const { exec } = require('child_process');
// const parseNmapOutput = require('../utils/parseNmap'); // We'll write this next

// exports.runNmapScan = (ip) => {
//   return new Promise((resolve, reject) => {
//     const cmd = `nmap -sS -Pn ${ip}`; // TCP SYN scan, no ping

//     exec(cmd, (err, stdout, stderr) => {
//       if (err) {
//         console.error(`nmap error for IP ${ip}:`, stderr);
//         return reject(stderr);
//       }

//       const results = parseNmapOutput(stdout, ip);
//       resolve(results);
//     });
//   });
// };
// const { exec } = require('child_process');
// const parseNmapOutput = require('../utils/parseNmap');

// exports.runNmapScan = (ip, onProgress) => {
//   return new Promise((resolve, reject) => {
//     // Optionally: call onProgress with start message
//     if (onProgress) onProgress(0, `Starting scan for ${ip}`);

//     const cmd = `nmap -sS -Pn ${ip}`; // TCP SYN scan, no ping

//     exec(cmd, (err, stdout, stderr) => {
//       if (err) {
//         console.error(`nmap error for IP ${ip}:`, stderr);
//         return reject(stderr);
//       }

//       if (onProgress) onProgress(100, `Completed scan for ${ip}`);

//       const results = parseNmapOutput(stdout, ip);
//       resolve(results);
//     });
//   });
// };
const { exec } = require('child_process');
const parseNmapOutput = require('../utils/parseNmap');
const { analyzeScan } = require('./vulnerabilityDetection'); // ⬅️ Import the detection service

/**
 * Executes Nmap scan, parses output, enriches each result with detection metadata.
 */
exports.runNmapScan = (ip, onProgress) => {
  return new Promise((resolve, reject) => {
    const cmd = `nmap -sS -Pn ${ip}`;

    if (onProgress) onProgress(0, `Starting scan for ${ip}`);

    exec(cmd, async (err, stdout, stderr) => {
      if (err) {
        console.error(`nmap error for IP ${ip}:`, stderr);
        return reject(stderr);
      }

      // Step 1: Parse basic data
      const parsed = parseNmapOutput(stdout);

      // Step 2: Enrich each result with detection info (score, vulnerabilities)
      const enriched = await Promise.all(
        parsed.map(async (entry) => {
          const detection = await analyzeScan(entry); // 🔍 Detect and score
          return {
            ...entry,
            ...detection,
            scanCommand: cmd,
            rawOutput: stdout,
            scannedAt: new Date(),
          };
        })
      );

      if (onProgress) onProgress(100, `Completed scan for ${ip}`);
      resolve(enriched);
    });
  });
};


// const { exec } = require('child_process');
// const parseNmapXml = require('../utils/parseNmap'); // You’ll create this next

// exports.runNmapScan = (ip) => {
//   return new Promise((resolve, reject) => {
//     const cmd = `nmap -sV --script vulners -oX - ${ip}`;

//     exec(cmd, async (err, stdout, stderr) => {
//       if (err) {
//         console.error(`Nmap error for IP ${ip}:`, stderr);
//         return reject(stderr);
//       }

//       try {
//         const parsedResults = await parseNmapXml(stdout, ip);
//         resolve(parsedResults);
//       } catch (e) {
//         console.error('Parse error:', e.message);
//         reject(e.message);
//       }
//     });
//   });
// };

