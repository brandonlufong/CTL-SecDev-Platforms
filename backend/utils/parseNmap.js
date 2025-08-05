// module.exports = function parseNmapOutput(output, ip) {
//   const lines = output.split('\n');
//   const results = [];

//   let inPortSection = false;

//   for (let line of lines) {
//     line = line.trim();

//     if (line.startsWith('PORT')) {
//       inPortSection = true;
//       continue;
//     }

//     if (inPortSection && line && /^[0-9]/.test(line)) {
//       const parts = line.split(/\s+/);
//       const [portProto, state, service] = parts;

//       const [port] = portProto.split('/');

//       results.push({
//         port: parseInt(port),
//         state,
//         service,
//       });
//     }

//     if (inPortSection && line === '') break;
//   }

//   return results;
// };
module.exports = function parseNmapOutput(output) {
  const lines = output.split('\n');
  const results = [];

  let inPortSection = false;
  let currentResult = null;

  for (let line of lines) {
    line = line.trim();

    // Start of port section
    if (line.startsWith('PORT')) {
      inPortSection = true;
      continue;
    }

    // End of port section
    if (inPortSection && line === '') {
      inPortSection = false;
      continue;
    }

    // Parse port line
    if (inPortSection && /^[0-9]/.test(line)) {
      const parts = line.split(/\s+/);
      const [portProto, state, service, ...rest] = parts;
      const [port, protocol] = portProto.split('/');

      const versionInfo = rest.join(' '); // Might contain product/version/CPE info

      currentResult = {
        port: parseInt(port, 10),
        protocol,
        state,
        service,
        product: '',
        version: '',
        cpe: '',
        vulnerabilityScore: 0,
        notes: '',
        vulnerabilities: [],
      };

      // Attempt to parse product/version from versionInfo
      const versionMatch = versionInfo.match(/(.+?)\s+([0-9][\w\.\-]+)/);
      if (versionMatch) {
        currentResult.product = versionMatch[1].trim();
        currentResult.version = versionMatch[2].trim();
      } else {
        currentResult.product = versionInfo.trim();
      }

      results.push(currentResult);
    }

    // Parse CPE or vulnerabilities under each port
    if (currentResult && line.startsWith('|')) {
      if (line.includes('CPE:')) {
        const cpeMatch = line.match(/CPE:\s*(cpe:\/[^\s]+)/i);
        if (cpeMatch) currentResult.cpe = cpeMatch[1];
      }

      if (line.includes('CVE')) {
        const cveMatches = [...line.matchAll(/(CVE-\d{4}-\d{4,7})/gi)];
        const cves = cveMatches.map(match => match[1].toUpperCase());
        currentResult.vulnerabilities.push(...cves);

        // Score is just a count for now — you could fetch real CVSS later
        currentResult.vulnerabilityScore = cves.length;
      }
    }
  }

  return results;
};


// module.exports = async function parseNmapXml(xml, ip) {
//   const parser = new xml2js.Parser({ explicitArray: false });

//   try {
//     const result = await parser.parseStringPromise(xml);
//     const portsData = result?.nmaprun?.host?.ports?.port;

//     if (!portsData) return []; // No ports to process

//     // Normalize to array if only one port
//     const portArray = Array.isArray(portsData) ? portsData : [portsData];

//     return portArray.map((port) => {
//       const portMeta = port?.$ || {};
//       const stateMeta = port?.state?.$ || {};
//       const serviceMeta = port?.service?.$ || {};
//       const cpeData = port?.service?.cpe;

//       // Vulnerability scripts, e.g. from Vulners NSE script
//       let vulns = [];
//       if (Array.isArray(port.script)) {
//         vulns = port.script
//           .filter((s) => s?.$?.id === 'vulners')
//           .map((s) => s._ || '')
//           .filter(Boolean);
//       } else if (port?.script?.$?.id === 'vulners') {
//         vulns = [port.script._ || ''];
//       }

//       return {
//         port: parseInt(portMeta.portid, 10) || 0,
//         protocol: portMeta.protocol || 'tcp',
//         state: stateMeta.state || 'unknown',
//         service: serviceMeta.name || '',
//         product: serviceMeta.product || '',
//         version: serviceMeta.version || '',
//         cpe: Array.isArray(cpeData) ? cpeData[0] : cpeData || serviceMeta.cpe || '',
//         vulnerabilities: vulns,
//       };
//     });
//   } catch (err) {
//     console.error('Nmap XML parsing error:', err.message);
//     return [];
//   }
// };

