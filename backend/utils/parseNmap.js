const xml2js = require('xml2js');

/**
 * Enhanced Nmap output parser with better service detection and CPE extraction
 */

async function parseNmapXml(xmlOutput) {
  const parser = new xml2js.Parser({ explicitArray: false });
  
  try {
    const result = await parser.parseStringPromise(xmlOutput);
    const host = result?.nmaprun?.host;
    if (!host) return [];

    const ports = host.ports?.port;
    if (!ports) return [];

    const portArray = Array.isArray(ports) ? ports : [ports];
    
    return portArray.map(port => {
      const portInfo = port.$ || {};
      const state = port.state?.$ || {};
      const service = port.service?.$ || {};
      
      let cpe = '';
      if (service.cpe) {
        cpe = Array.isArray(service.cpe) ? service.cpe[0] : service.cpe;
      }
      
      let vulnerabilities = [];
      let scriptOutput = '';
      
      if (port.script) {
        const scripts = Array.isArray(port.script) ? port.script : [port.script];
        scripts.forEach(script => {
          if (script.$.id === 'vulners') {
            scriptOutput = script._ || '';
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

function parseNmapText(output) {
  const lines = output.split('\n');
  const results = [];
  
  let inPortSection = false;

  for (let line of lines) {
    line = line.trim();

    if (line.startsWith('PORT') && line.includes('STATE') && line.includes('SERVICE')) {
      inPortSection = true;
      continue;
    }

    if (inPortSection && (line === '' || line.startsWith('Service detection') || line.startsWith('Nmap done'))) {
      inPortSection = false;
      continue;
    }

    if (inPortSection && /^[0-9]/.test(line)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const [portProto, state, service, ...versionParts] = parts;
        const [port, protocol] = portProto.split('/');
        const versionInfo = versionParts.join(' ');
        
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

        if (versionInfo) {
          const productVersionMatch = versionInfo.match(/^([^0-9\(]+?)\s+([0-9][^\s\(]*)/);
          if (productVersionMatch) {
            result.product = productVersionMatch[1].trim();
            result.version = productVersionMatch[2].trim();
          } else {
            result.product = versionInfo.replace(/\([^)]*\)/g, '').trim();
          }

          const extraInfoMatch = versionInfo.match(/\(([^)]+)\)/);
          if (extraInfoMatch) {
            result.extraInfo = extraInfoMatch[1];
          }

          const cpeMatch = versionInfo.match(/cpe:\/[^\s)]+/i);
          if (cpeMatch) {
            result.cpe = cpeMatch[0];
          }
        }

        results.push(result);
      }
    }

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

function generateCPE(serviceInfo) {
  const { product, version, service } = serviceInfo;
  if (!product) return '';
  const cpeProduct = product.toLowerCase().replace(/\s+/g, '_');
  const cpeVersion = version || '*';
  let cpePart = 'a';
  if (['ssh', 'http', 'https', 'ftp', 'smtp', 'mysql'].includes(service)) {
    cpePart = 'a';
  }
  return `cpe:/${cpePart}:${cpeProduct}:${cpeProduct}:${cpeVersion}`;
}

module.exports = async function parseNmapOutput(output) {
  if (output.includes('<?xml') || output.includes('<nmaprun')) {
    return await parseNmapXml(output);
  } else {
    const results = parseNmapText(output);
    return results.map(result => {
      if (!result.cpe && result.product) {
        result.cpe = generateCPE(result);
      }
      return result;
    });
  }
};

module.exports.parseNmapXml = parseNmapXml;
module.exports.parseNmapText = parseNmapText;
module.exports.generateCPE = generateCPE;

