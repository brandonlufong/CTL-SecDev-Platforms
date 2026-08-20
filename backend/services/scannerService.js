const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const net = require('net');
const parseNmapOutput = require('../utils/parseNmap');
const vulnerabilityDetection = require('./vulnerabilityDetection');

const execAsync = promisify(exec);

/**
 * Cross-platform Scanner Service (v3)
 *
 * Key design decisions (see plan "Workstream A"):
 *  - Uses child_process.spawn with an ARGV ARRAY and NO shell. This removes the
 *    shell-syntax fragility and command-injection surface of the old exec()
 *    string, and works identically on Windows, Linux and macOS (no /bin/bash
 *    assumption).
 *  - Probes the host ONCE at first use for: nmap binary path + version, raw-socket
 *    privileges (root / cap_net_raw), and which NSE vuln scripts are installed.
 *    The scan command is then built adaptively so we never emit an option the
 *    environment cannot honor, and never fail silently.
 *  - Progress is read from STDERR (`--stats-every`) because with `-oX -` the XML
 *    goes to stdout and the human-readable progress lines go to stderr.
 */
class ScannerService {
  constructor() {
    this.defaultTimeout = 600000; // 10 minutes
    this.maxConcurrentScans = parseInt(process.env.MAX_CONCURRENT_SCANS || '3', 10);
    this.activeScanCount = 0;

    this.platform = process.platform;
    this.isWindows = this.platform === 'win32';
    this.isMac = this.platform === 'darwin';
    this.isLinux = this.platform === 'linux';

    // Populated by probeCapabilities()
    this.caps = null;
    this._probePromise = null;
  }

  // ---------------------------------------------------------------------------
  // Capability probing
  // ---------------------------------------------------------------------------

  /**
   * Probe the host once and cache the result. Safe to call repeatedly.
   */
  async ensureProbed() {
    if (this.caps) return this.caps;
    if (!this._probePromise) {
      this._probePromise = this.probeCapabilities();
    }
    this.caps = await this._probePromise;
    return this.caps;
  }

  async probeCapabilities() {
    const caps = {
      platform: this.platform,
      nmapPath: null,
      nmapAvailable: false,
      nmapVersion: null,
      privileged: false,
      privilegeMethod: 'none',
      scripts: { vulners: false, vulscan: false, vuln: true },
      warnings: []
    };

    // 1. Resolve the nmap binary. Honor an explicit override first (useful when
    //    node runs under systemd/pm2 with a minimal PATH).
    caps.nmapPath = await this.resolveNmapPath();
    if (!caps.nmapPath) {
      caps.warnings.push(
        'nmap binary not found. Install nmap and/or set NMAP_PATH to its full path.'
      );
      return caps;
    }

    // 2. Version check (also confirms the binary is executable).
    try {
      const { stdout } = await execAsync(`"${caps.nmapPath}" --version`, { timeout: 8000 });
      caps.nmapAvailable = true;
      const m = stdout.match(/Nmap version\s+([\d.]+)/i);
      caps.nmapVersion = m ? m[1] : 'unknown';
    } catch (err) {
      caps.warnings.push(`Found nmap at ${caps.nmapPath} but it failed to run: ${err.message}`);
      return caps;
    }

    // 3. Raw-socket privileges (needed for -sS SYN, -sU UDP, -O OS detection).
    const priv = await this.detectPrivileges();
    caps.privileged = priv.privileged;
    caps.privilegeMethod = priv.method;
    if (!caps.privileged) {
      caps.warnings.push(
        'Running without raw-socket privileges: SYN/UDP/OS scans are unavailable. ' +
        'On Linux grant them once with:  sudo setcap cap_net_raw,cap_net_admin,cap_net_bind_service+eip $(command -v nmap)'
      );
    }

    // 4. Which vuln NSE scripts are installed (so we never reference a missing one).
    caps.scripts.vulners = await this.hasScript(caps.nmapPath, 'vulners');
    caps.scripts.vulscan = await this.hasScript(caps.nmapPath, 'vulscan');

    console.log(
      `[scanner] nmap ${caps.nmapVersion} @ ${caps.nmapPath} | privileged=${caps.privileged}` +
      ` (${caps.privilegeMethod}) | scripts: vulners=${caps.scripts.vulners} vulscan=${caps.scripts.vulscan}`
    );
    caps.warnings.forEach(w => console.warn(`[scanner] ${w}`));

    return caps;
  }

  async resolveNmapPath() {
    // Explicit override wins.
    if (process.env.NMAP_PATH && process.env.NMAP_PATH.trim()) {
      return process.env.NMAP_PATH.trim();
    }
    // Locate on PATH.
    try {
      const cmd = this.isWindows ? 'where nmap' : 'command -v nmap';
      const { stdout } = await execAsync(cmd, { timeout: 6000 });
      const first = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
      if (first) return first;
    } catch (_) { /* fall through */ }

    // Common fixed locations as a last resort (PATH may be stripped by systemd).
    const candidates = this.isWindows
      ? ['C:\\Program Files (x86)\\Nmap\\nmap.exe', 'C:\\Program Files\\Nmap\\nmap.exe']
      : ['/usr/bin/nmap', '/usr/local/bin/nmap', '/opt/homebrew/bin/nmap', '/snap/bin/nmap'];
    for (const c of candidates) {
      try {
        require('fs').accessSync(c);
        return c;
      } catch (_) { /* not here */ }
    }
    return null;
  }

  async detectPrivileges() {
    if (this.isWindows) {
      // With Npcap installed, nmap performs raw-socket scans without an explicit
      // admin check we can reliably read from Node. Assume capable and let nmap
      // report if not.
      return { privileged: true, method: 'windows-npcap' };
    }
    // Root always has raw sockets.
    try {
      if (process.getuid && process.getuid() === 0) {
        return { privileged: true, method: 'root' };
      }
    } catch (_) { /* getuid unavailable */ }

    // Non-root: check whether the nmap binary carries cap_net_raw (Linux).
    if (this.isLinux) {
      try {
        const path = await this.resolveNmapPath();
        const { stdout } = await execAsync(`getcap "${path}"`, { timeout: 5000 });
        if (/cap_net_raw/i.test(stdout)) {
          return { privileged: true, method: 'cap_net_raw' };
        }
      } catch (_) { /* getcap missing or no caps */ }
    }
    return { privileged: false, method: 'none' };
  }

  async hasScript(nmapPath, scriptName) {
    try {
      const { stdout, stderr } = await execAsync(
        `"${nmapPath}" --script-help ${scriptName}`,
        { timeout: 8000 }
      );
      const out = `${stdout}\n${stderr}`;
      // When the script exists, --script-help prints its name + description.
      return new RegExp(`\\b${scriptName}\\b`, 'i').test(out) && !/No scripts/i.test(out);
    } catch (_) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Main scan entry point
  // ---------------------------------------------------------------------------

  async runNmapScan(ip, options = {}) {
    const {
      onProgress,
      scanType = 'quick',
      timeout = this.getScanTimeout(scanType),
      includeVulnScripts = true
    } = options;

    const caps = await this.ensureProbed();
    if (!caps.nmapAvailable) {
      const msg =
        'Nmap is not available on this server. Install it (e.g. `sudo apt-get install -y nmap` ' +
        'or `sudo yum install -y nmap`) or set the NMAP_PATH environment variable to its full path.';
      if (onProgress) onProgress(0, msg);
      throw new Error(msg);
    }

    if (this.activeScanCount >= this.maxConcurrentScans) {
      throw new Error('Maximum concurrent scans reached. Please wait for current scans to complete.');
    }

    this.activeScanCount++;
    try {
      if (onProgress) onProgress(0, `Initializing scan for ${ip}`);

      const args = this.buildNmapArgs(ip, scanType, includeVulnScripts, caps);
      if (onProgress) onProgress(10, `Starting ${scanType} scan for ${ip}`);
      console.log(`[scanner] ${caps.nmapPath} ${args.join(' ')}`);

      const rawOutput = await this.executeNmap(caps.nmapPath, args, { timeout, onProgress });
      if (onProgress) onProgress(70, `Parsing scan results for ${ip}`);

      const parsedResults = await parseNmapOutput(rawOutput);
      if (onProgress) onProgress(80, `Analyzing vulnerabilities for ${ip}`);

      const enhancedResults = await this.enhanceResultsWithVulnerabilities(parsedResults, ip, onProgress);
      if (onProgress) onProgress(100, `Scan completed for ${ip}`);

      return enhancedResults;
    } catch (error) {
      console.error(`[scanner] Scan error for ${ip}:`, error.message);
      if (onProgress) onProgress(0, `Scan failed for ${ip}: ${error.message}`);
      throw error;
    } finally {
      this.activeScanCount--;
    }
  }

  getScanTimeout(scanType) {
    const timeouts = {
      quick: 300000,          // 5 min  - top 100 ports
      comprehensive: 1800000, // 30 min - top 10000 ports
      stealth: 2400000,       // 40 min - slow timing
      udp: 1800000,           // 30 min - UDP is slow
      vulnerability: 1200000  // 20 min - with vuln scripts
    };
    return timeouts[scanType] || this.defaultTimeout;
  }

  // ---------------------------------------------------------------------------
  // Command building (returns an argv ARRAY - never a shell string)
  // ---------------------------------------------------------------------------

  buildNmapArgs(ip, scanType, includeVulnScripts, caps) {
    const args = [];
    const privileged = caps.privileged;

    // Common to every scan.
    args.push('-Pn');                        // skip host-discovery ping (firewall friendly)
    args.push('-sV');                        // service/version detection
    args.push('--version-intensity', '7');
    args.push('-oX', '-');                   // XML to stdout
    args.push('--stats-every', '2s');        // periodic progress to stderr

    const tcpScan = privileged ? '-sS' : '-sT';

    switch (scanType) {
      case 'quick':
        args.push('-F', tcpScan, '-T4');
        break;

      case 'comprehensive':
        args.push(tcpScan, '--top-ports', '10000', '-T4');
        if (privileged) args.push('-O');     // OS detection needs raw sockets
        args.push('--max-retries', '2', '--host-timeout', '1500s', '--max-rtt-timeout', '500ms');
        break;

      case 'stealth':
        args.push(tcpScan, '-T2', '--top-ports', '1000');
        args.push('--max-retries', '1', '--scan-delay', '200ms', '--max-rtt-timeout', '1000ms');
        break;

      case 'udp':
        if (!privileged) {
          throw new Error(
            'UDP scans require raw-socket privileges. Grant them with ' +
            '`sudo setcap cap_net_raw+eip $(command -v nmap)` (Linux) or run as root, ' +
            'or choose the "quick"/"comprehensive" scan type instead.'
          );
        }
        args.push('-sU', '--top-ports', '100', '-T4');
        args.push('--max-retries', '1', '--host-timeout', '1200s', '--max-rtt-timeout', '1000ms');
        break;

      case 'vulnerability':
        args.push(tcpScan, '--top-ports', '1000', '-T4', '--max-retries', '2');
        if (includeVulnScripts) {
          this.appendVulnScripts(args, caps);
        }
        break;

      default:
        args.push(tcpScan, '--top-ports', '1000', '-T4');
    }

    // Target LAST. Passed as its own argv element - no shell interpolation.
    args.push(ip);
    return args;
  }

  /**
   * Only reference vuln scripts that actually exist on this host, and prefer
   * `vulners` (fast, CVE-rich, needs -sV which we always pass) over the heavy
   * `vuln` category. Never emit `--script-args unsafe=1`.
   */
  appendVulnScripts(args, caps) {
    if (caps.scripts.vulners) {
      args.push('--script', 'vulners');
    } else if (caps.scripts.vulscan) {
      args.push('--script', 'vulscan/vulscan.nse');
    } else {
      // Fall back to the built-in safe vuln category.
      args.push('--script', 'vuln');
    }
    args.push('--script-timeout', '120s');
  }

  // ---------------------------------------------------------------------------
  // Execution via spawn
  // ---------------------------------------------------------------------------

  executeNmap(nmapPath, args, { timeout, onProgress }) {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      let killTimer = null;
      let hardKillTimer = null;

      const child = spawn(nmapPath, args, { windowsHide: true });

      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        if (killTimer) clearTimeout(killTimer);
        if (hardKillTimer) clearTimeout(hardKillTimer);
        fn(arg);
      };

      // Graceful timeout: SIGTERM, then SIGKILL if it ignores us.
      if (timeout && timeout > 0) {
        killTimer = setTimeout(() => {
          try { child.kill('SIGTERM'); } catch (_) {}
          hardKillTimer = setTimeout(() => {
            try { child.kill('SIGKILL'); } catch (_) {}
          }, 10000);
          finish(reject, new Error(
            `Scan timed out after ${Math.round(timeout / 1000)}s. Try a quicker scan type or a smaller target.`
          ));
        }, timeout);
      }

      child.on('error', (err) => {
        if (err.code === 'ENOENT') {
          finish(reject, new Error(
            `Nmap executable not found at "${nmapPath}". Install nmap or set NMAP_PATH.`
          ));
        } else {
          finish(reject, new Error(`Failed to launch nmap: ${err.message}`));
        }
      });

      child.stdout.on('data', (d) => { stdout += d.toString(); });

      let lastPct = 10;
      child.stderr.on('data', (d) => {
        const text = d.toString();
        stderr += text;
        if (!onProgress) return;
        // nmap stats lines look like: "Stats: ... 42.13% done; ETC: ..."
        const m = text.match(/([\d.]+)%\s+done/);
        if (m) {
          const nmapPct = parseFloat(m[1]);
          // Map nmap's 0-100 onto our 10-65 scanning band.
          const pct = Math.min(65, Math.max(lastPct, 10 + Math.floor(nmapPct * 0.55)));
          lastPct = pct;
          onProgress(pct, `Scanning... ${nmapPct.toFixed(0)}% complete`);
        } else if (/SYN Stealth Scan|Connect Scan/i.test(text)) {
          onProgress(Math.max(lastPct, 20), 'Scanning ports...');
        } else if (/Service scan|Version detection/i.test(text)) {
          onProgress(Math.max(lastPct, 50), 'Detecting services...');
        } else if (/NSE|Script/i.test(text)) {
          onProgress(Math.max(lastPct, 60), 'Running vulnerability scripts...');
        }
      });

      child.on('close', (code) => {
        // nmap exits 0 on success. Some NSE script failures still yield usable XML.
        if (stdout && (stdout.includes('<nmaprun') || stdout.includes('<?xml'))) {
          return finish(resolve, stdout);
        }
        const errText = (stderr || '').trim();
        if (/requires (root|elevated) privileges/i.test(errText)) {
          return finish(reject, new Error(
            'This scan requires raw-socket privileges. Grant them with ' +
            '`sudo setcap cap_net_raw+eip $(command -v nmap)` or run as root, or use the "quick" scan.'
          ));
        }
        if (/Failed to resolve/i.test(errText)) {
          return finish(reject, new Error('Failed to resolve target. Check the IP address / hostname.'));
        }
        if (/invalid option|unrecognized/i.test(errText)) {
          return finish(reject, new Error(`Your nmap version rejected an option: ${errText.split('\n')[0]}`));
        }
        finish(reject, new Error(
          errText
            ? `Nmap exited with code ${code}: ${errText.split('\n').slice(0, 3).join(' ')}`
            : `Nmap produced no output (exit ${code}). Target may be offline or unreachable.`
        ));
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Vulnerability enhancement (unchanged contract; detection service fixed in B)
  // ---------------------------------------------------------------------------

  async enhanceResultsWithVulnerabilities(scanResults, targetIP, onProgress) {
    const enhancedResults = [];
    const totalResults = scanResults.length;

    if (totalResults === 0) {
      console.warn(`[scanner] No open ports/results to enhance for ${targetIP}`);
      return enhancedResults;
    }

    for (let i = 0; i < scanResults.length; i++) {
      const result = scanResults[i];
      if (onProgress) {
        const progress = 80 + Math.floor((i / totalResults) * 15);
        onProgress(progress, `Analyzing port ${result.port} (${result.state})...`);
      }

      try {
        let vulnAnalysis;
        if (result.state === 'open') {
          vulnAnalysis = await vulnerabilityDetection.analyzeScan(result);
        } else {
          vulnAnalysis = {
            vulnerabilityScore: 0,
            vulnerabilities: [],
            detectionDetails: [],
            confidence: 0,
            detectionMethods: [],
            scanEnhancement: `Port is ${result.state} - no vulnerabilities to analyze`
          };
        }

        enhancedResults.push({
          ...result,
          targetIP,
          vulnerabilityScore: vulnAnalysis.vulnerabilityScore,
          vulnerabilities: vulnAnalysis.vulnerabilities,
          detectionDetails: vulnAnalysis.detectionDetails,
          confidence: vulnAnalysis.confidence,
          detectionMethods: vulnAnalysis.detectionMethods,
          scanEnhancement: vulnAnalysis.scanEnhancement,
          scannedAt: new Date(),
          scanMetadata: {
            totalVulnerabilities: (vulnAnalysis.detectionDetails || []).length,
            highestSeverity: this.getHighestSeverity(vulnAnalysis.detectionDetails || []),
            riskLevel: this.calculateRiskLevel(vulnAnalysis.vulnerabilityScore, vulnAnalysis.confidence),
            platform: this.platform
          }
        });
      } catch (error) {
        console.error(`[scanner] Error analyzing port ${result.port}:`, error.message);
        enhancedResults.push({
          ...result,
          targetIP,
          vulnerabilityScore: 0,
          vulnerabilities: [],
          detectionDetails: [],
          confidence: 0,
          error: error.message,
          scannedAt: new Date()
        });
      }
    }

    const summary = {
      total: enhancedResults.length,
      open: enhancedResults.filter(r => r.state === 'open').length,
      closed: enhancedResults.filter(r => r.state === 'closed').length,
      filtered: enhancedResults.filter(r => r.state === 'filtered').length,
      withVulns: enhancedResults.filter(r => r.vulnerabilities && r.vulnerabilities.length > 0).length
    };
    console.log(
      `[scanner] ${targetIP}: ${summary.open} open, ${summary.closed} closed, ` +
      `${summary.filtered} filtered | ${summary.withVulns} ports with vulns (${summary.total} total)`
    );

    return enhancedResults;
  }

  getHighestSeverity(vulnerabilities) {
    if (!vulnerabilities || vulnerabilities.length === 0) return 'None';
    const order = ['Critical', 'High', 'Medium', 'Low', 'Informational'];
    for (const sev of order) {
      if (vulnerabilities.some(v => v.severity === sev)) return sev;
    }
    return 'Unknown';
  }

  calculateRiskLevel(vulnerabilityScore, confidence) {
    if (!vulnerabilityScore) return 'Low';
    const adjusted = vulnerabilityScore * ((confidence || 0) / 100);
    if (adjusted >= 8.0) return 'Critical';
    if (adjusted >= 6.0) return 'High';
    if (adjusted >= 4.0) return 'Medium';
    return 'Low';
  }

  // ---------------------------------------------------------------------------
  // Connectivity helpers
  // ---------------------------------------------------------------------------

  async tcpTest(ip, port = 80, timeout = 2000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timer = setTimeout(() => { socket.destroy(); resolve(false); }, timeout);
      socket.on('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true); });
      socket.on('error', () => { clearTimeout(timer); socket.destroy(); resolve(false); });
      socket.connect(port, ip);
    });
  }

  /** Single IPv4 (used by ping / connectivity helpers). */
  isSingleIPv4(ip) {
    return /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/.test(ip);
  }

  /**
   * Accepts a single IPv4/IPv6 address, an IPv4 CIDR (e.g. 10.0.0.0/24) or a
   * hyphenated octet range (e.g. 10.0.0.1-50). nmap understands all of these
   * natively, so we only need to validate the shape.
   */
  validateIP(target) {
    if (typeof target !== 'string' || !target.trim()) return false;
    const t = target.trim();
    if (this.isSingleIPv4(t)) return true;
    // IPv4 CIDR
    if (/^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\/(?:[0-9]|[12]\d|3[0-2])$/.test(t)) return true;
    // IPv4 hyphen range in any octet, e.g. 10.0.0.1-50 or 10.0.1-3.0-255
    if (/^(?:\d{1,3}(?:-\d{1,3})?\.){3}\d{1,3}(?:-\d{1,3})?$/.test(t)) return true;
    // Basic IPv6
    if (/^(?:[a-fA-F0-9:]+:+)+[a-fA-F0-9]*(?:%[a-zA-Z0-9]+)?$/.test(t) && t.includes(':')) return true;
    return false;
  }

  async pingTest(ip) {
    if (!this.isSingleIPv4(ip)) {
      // Ranges/CIDRs cannot be pinged directly; treat as "attempt scan anyway".
      return true;
    }
    try {
      const args = this.isWindows ? ['-n', '1', '-w', '1000', ip] : ['-c', '1', '-W', '1', ip];
      const ok = await new Promise((resolve) => {
        const p = spawn('ping', args, { windowsHide: true });
        let out = '';
        p.stdout.on('data', d => { out += d.toString(); });
        p.on('error', () => resolve(false));
        p.on('close', () => {
          const reachable = this.isWindows
            ? /Reply from|bytes=|TTL=/i.test(out)
            : /1 (?:packets )?received|bytes from/i.test(out);
          resolve(reachable);
        });
      });
      console.log(`[scanner] Ping ${ip}: ${ok ? 'reachable' : 'no reply'}`);
      return ok;
    } catch (error) {
      console.log(`[scanner] Ping ${ip} failed: ${error.message}`);
      return false;
    }
  }

  async enhancedConnectivityTest(ip) {
    if (await this.pingTest(ip)) {
      return { reachable: true, method: 'ping' };
    }
    const commonPorts = [80, 443, 22, 3389, 8080, 21, 25, 3306];
    for (const port of commonPorts) {
      if (await this.tcpTest(ip, port, 1000)) {
        return { reachable: true, method: `tcp:${port}` };
      }
    }
    return { reachable: false, method: 'none' };
  }

  // ---------------------------------------------------------------------------
  // Host discovery (subnet sweep)
  // ---------------------------------------------------------------------------

  /**
   * Ping-sweep a CIDR / range and return the live hosts. Uses `nmap -sn` (no
   * port scan). Falls back to a TCP-based sweep automatically when unprivileged
   * (nmap -sn handles that internally).
   */
  async discoverHosts(target, options = {}) {
    const caps = await this.ensureProbed();
    if (!caps.nmapAvailable) {
      throw new Error('Nmap is not available; cannot run host discovery.');
    }
    if (!this.validateIP(target)) {
      throw new Error('Invalid discovery target. Use an IP, CIDR (10.0.0.0/24) or range.');
    }
    const timeout = options.timeout || 300000;
    const args = ['-sn', '-oX', '-', '--stats-every', '2s', '-T4', target];
    if (options.onProgress) options.onProgress(5, `Discovering hosts on ${target}`);

    const xml = await this.executeNmap(caps.nmapPath, args, { timeout, onProgress: options.onProgress });
    const xml2js = require('xml2js');
    const parsed = await new xml2js.Parser({ explicitArray: false }).parseStringPromise(xml);

    let hosts = parsed?.nmaprun?.host || [];
    hosts = Array.isArray(hosts) ? hosts : [hosts];

    const live = [];
    for (const h of hosts) {
      const status = h.status?.$?.state;
      if (status !== 'up') continue;
      const addrs = Array.isArray(h.address) ? h.address : [h.address].filter(Boolean);
      const ipv4 = addrs.find(a => a.$?.addrtype === 'ipv4');
      const mac = addrs.find(a => a.$?.addrtype === 'mac');
      const hn = h.hostnames?.hostname;
      const hostname = hn ? (Array.isArray(hn) ? hn[0]?.$?.name : hn.$?.name) : null;
      if (ipv4) {
        live.push({
          ip: ipv4.$.addr,
          mac: mac?.$?.addr || null,
          vendor: mac?.$?.vendor || null,
          hostname: hostname || null,
          status: 'up'
        });
      }
    }
    if (options.onProgress) options.onProgress(100, `Found ${live.length} live host(s)`);
    return live;
  }

  // ---------------------------------------------------------------------------
  // Stats / batch
  // ---------------------------------------------------------------------------

  getScanStats() {
    const caps = this.caps || {};
    return {
      activeScanCount: this.activeScanCount,
      maxConcurrentScans: this.maxConcurrentScans,
      canStartNewScan: this.activeScanCount < this.maxConcurrentScans,
      platform: this.platform,
      nmapAvailable: !!caps.nmapAvailable,
      nmapVersion: caps.nmapVersion || null,
      nmapPath: caps.nmapPath || null,
      privileged: !!caps.privileged,
      privilegeMethod: caps.privilegeMethod || 'unknown',
      scripts: caps.scripts || null,
      warnings: caps.warnings || [],
      availableScanTypes: caps.privileged
        ? ['quick', 'comprehensive', 'stealth', 'udp', 'vulnerability']
        : ['quick', 'comprehensive', 'stealth', 'vulnerability']
    };
  }

  async runBatchScan(ipList, options = {}) {
    const results = [];
    const errors = [];
    const { maxConcurrent = 2 } = options;

    const validIPs = ipList.filter(ip => {
      if (!this.validateIP(ip)) {
        errors.push({ ip, error: 'Invalid IP address format' });
        return false;
      }
      return true;
    });

    if (validIPs.length === 0) {
      throw new Error('No valid IP addresses provided');
    }

    for (let i = 0; i < validIPs.length; i += maxConcurrent) {
      const batch = validIPs.slice(i, i + maxConcurrent);
      if (options.onProgress) {
        options.onProgress(
          Math.floor((i / validIPs.length) * 100),
          `Processing batch ${Math.floor(i / maxConcurrent) + 1} of ${Math.ceil(validIPs.length / maxConcurrent)}`
        );
      }
      const batchResults = await Promise.all(batch.map(async (ip) => {
        try {
          const result = await this.runNmapScan(ip, options);
          return { ip, result, success: true };
        } catch (error) {
          return { ip, error: error.message, success: false };
        }
      }));
      batchResults.forEach(item => (item.success ? results : errors).push(item));
    }

    return { results, errors };
  }
}

// Singleton
const scannerService = new ScannerService();

// Kick off the capability probe at startup so the first scan is fast and
// GET /api/scan/progress reports real capabilities immediately.
scannerService.ensureProbed().catch(err =>
  console.error('[scanner] Capability probe failed:', err.message)
);

module.exports = {
  runNmapScan: (ip, onProgressOrOptions) => {
    if (typeof onProgressOrOptions === 'function') {
      return scannerService.runNmapScan(ip, { onProgress: onProgressOrOptions });
    }
    return scannerService.runNmapScan(ip, onProgressOrOptions || {});
  },
  runBatchScan: (ipList, options) => scannerService.runBatchScan(ipList, options),
  discoverHosts: (target, options) => scannerService.discoverHosts(target, options),
  getScanStats: () => scannerService.getScanStats(),
  probeCapabilities: () => scannerService.ensureProbed(),
  validateIP: (ip) => scannerService.validateIP(ip),
  pingTest: (ip) => scannerService.pingTest(ip),
  tcpTest: (ip, port, timeout) => scannerService.tcpTest(ip, port, timeout),
  enhancedConnectivityTest: (ip) => scannerService.enhancedConnectivityTest(ip),
  // Exposed for unit testing
  _service: scannerService
};
