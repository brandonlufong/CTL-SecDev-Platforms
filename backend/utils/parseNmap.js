const xml2js = require('xml2js');

/**
 * Enhanced Nmap output parser with better service detection and CPE extraction
 */

/**
 * Parse Nmap XML output (recommended for better structured data)
 */
async function parseNmapXml(xmlOutput) {
  const parser = new xml2js.Parser({ explicitArray: false });
  
  try {
    const result = await parser.parseStringPromise(xmlOutput);
    const host = result?.nmaprun?.host;
    
    if (!host) return [];

    const ports = host.ports?.port;
    if (!ports) return [];

    // Normalize to array
    const portArray = Array.isArray(ports) ? ports : [ports];
    
    return portArray.map(port => {
      const portInfo = port.$ || {};
      const state = port.state?.$ || {};
      const service = port.service?.$ || {};
      
      // Extract CPE information
      let cpe = '';
      if (service.cpe) {
        cpe = Array.isArray(service.cpe) ? service.cpe[0] : service.cpe;
      }
      
      // Extract vulnerability information from scripts (if vulners script was used)
      let vulnerabilities = [];
      let scriptOutput = '';
      
      if (port.script) {
        const scripts = Array.isArray(port.script) ? port.script : [port.script];
        
        scripts.forEach(script => {
          if (script.$.id === 'vulners') {
            scriptOutput = script._ || '';
            // Parse CVE IDs from script output
            const cveMatches = scriptOutput.match(/CVE-\d{4}-\d{4,}/g);
            if (cveMatches) {
              vulnerabilities.push(...cveMatches);
            }
          }
        });
      }

      return {
        port: parseInt(portInfo.portid, 10) || 0,
        protocol: portInfo.protocol || 'tcp',
        state: state.state || 'unknown',
        service: service.name || 'unknown',
        product: service.product || '',
        version: service.version || '',
        extraInfo: service.extrainfo || '',
        cpe: cpe,
        vulnerabilities: vulnerabilities,
        scriptOutput: scriptOutput,
        confidence: parseInt(service.conf, 10) || 0
      };
    });
  } catch (error) {
    console.error('XML parsing failed, falling back to text parsing:', error.message);
    return parseNmapText(xmlOutput);
  }
}

/**
 * Parse Nmap text output (fallback method)
 */
function parseNmapText(output) {
  const lines = output.split('\n');
  const results = [];
  
  let inPortSection = false;
  let currentHost = null;

  for (let line of lines) {
    line = line.trim();

    // Detect host information
    const hostMatch = line.match(/Nmap scan report for (.+)/);
    if (hostMatch) {
      currentHost = hostMatch[1];
      continue;
    }

    // Start of port section
    if (line.startsWith('PORT') && line.includes('STATE') && line.includes('SERVICE')) {
      inPortSection = true;
      continue;
    }

    // End of port section
    if (inPortSection && (line === '' || line.startsWith('Service detection') || line.startsWith('Nmap done'))) {
      inPortSection = false;
      continue;
    }

    // Parse port information
    if (inPortSection && /^[0-9]/.test(line)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const [portProto, state, service, ...versionParts] = parts;
        const [port, protocol] = portProto.split('/');
        
        const versionInfo = versionParts.join(' ');
        
        // Enhanced version parsing
        const result = {
          port: parseInt(port, 10),
          protocol: protocol || 'tcp',
          state: state,
          service: service,
          product: '',
          version: '',
          extraInfo: '',
          cpe: '',
          vulnerabilities: [],
          confidence: 0
        };

        // Parse version information more intelligently
        if (versionInfo) {
          // Look for product name and version patterns
          const productVersionMatch = versionInfo.match(/^([^0-9\(]+?)\s+([0-9][^\s\(]*)/);
          if (productVersionMatch) {
            result.product = productVersionMatch[1].trim();
            result.version = productVersionMatch[2].trim();
          } else {
            // If no clear version, treat entire string as product
            result.product = versionInfo.replace(/\([^)]*\)/g, '').trim();
          }

          // Extract extra info from parentheses
          const extraInfoMatch = versionInfo.match(/\(([^)]+)\)/);
          if (extraInfoMatch) {
            result.extraInfo = extraInfoMatch[1];
          }

          // Look for CPE in the version info
          const cpeMatch = versionInfo.match(/cpe:\/[^\s)]+/i);
          if (cpeMatch) {
            result.cpe = cpeMatch[0];
          }
        }

        results.push(result);
      }
    }

    // Look for vulnerability script output
    if (line.includes('CVE-')) {
      const cveMatches = line.match(/CVE-\d{4}-\d{4,}/g);
      if (cveMatches && results.length > 0) {
        const lastResult = results[results.length - 1];
        lastResult.vulnerabilities.push(...cveMatches);
      }
    }
  }

  return results;
}

/**
 * Generate CPE string from service information
 */
function generateCPE(serviceInfo) {
  const { product, version, service } = serviceInfo;
  
  if (!product) return '';
  
  // Basic CPE generation - can be enhanced with a proper CPE database
  const cpeProduct = product.toLowerCase().replace(/\s+/g, '_');
  const cpeVersion = version || '*';
  
  // Determine CPE part (application, operating system, hardware)
  let cpePart = 'a'; // application by default
  
  if (service === 'ssh' || service === 'http' || service === 'https' || 
      service === 'ftp' || service === 'smtp' || service === 'mysql') {
    cpePart = 'a'; // application
  }
  
  return `cpe:/${cpePart}:${cpeProduct}:${cpeProduct}:${cpeVersion}`;
}

/**
 * Main parsing function that determines the best parsing method
 */
module.exports = async function parseNmapOutput(output) {
  // Determine if output is XML or text
  if (output.includes('<?xml') || output.includes('<nmaprun')) {
    return await parseNmapXml(output);
  } else {
    const results = parseNmapText(output);
    
    // Enhance results with generated CPE if not present
    return results.map(result => {
      if (!result.cpe && result.product) {
        result.cpe = generateCPE(result);
      }
      return result;
    });
  }
};

// Export additional utility functions
module.exports.parseNmapXml = parseNmapXml;
module.exports.parseNmapText = parseNmapText;
module.exports.generateCPE = generateCPE;

