# Scanning on Linux — production setup

The scanner (`services/scannerService.js`) auto-detects nmap and raw-socket
privileges at startup and adapts. This document explains what the Linux box
needs so scans behave the same as on Windows dev.

## 1. Install nmap (required)

```bash
# Debian / Ubuntu
sudo apt-get update && sudo apt-get install -y nmap
# RHEL / CentOS / Alma / Rocky
sudo yum install -y nmap        # or: sudo dnf install -y nmap
```

Verify:

```bash
command -v nmap && nmap --version
```

If nmap is installed in a non-standard location, or the Node process runs with a
stripped `PATH` (common under **systemd**/**pm2**), set an explicit path:

```bash
# .env
NMAP_PATH=/usr/bin/nmap
```

The service also checks `/usr/bin`, `/usr/local/bin`, `/opt/homebrew/bin`,
`/snap/bin` automatically. When nmap can't be found, a scan now fails with a
clear *"install nmap / set NMAP_PATH"* message instead of hanging.

## 2. Grant raw-socket privileges (recommended)

`-sS` (SYN), `-sU` (UDP) and `-O` (OS detection) need raw sockets. Without them
the scanner automatically falls back to `-sT` (TCP connect) and reports the
limitation via `GET /api/scan/progress` (`privileged:false`). To enable the full
feature set **without running Node as root**, grant the capability to the nmap
binary once:

```bash
sudo setcap cap_net_raw,cap_net_admin,cap_net_bind_service+eip $(command -v nmap)
# verify
getcap $(command -v nmap)     # -> .../nmap cap_net_admin,cap_net_raw,cap_net_bind_service=eip
```

The service auto-detects this (`privilegeMethod: "cap_net_raw"`). Running Node as
root also works (`privilegeMethod: "root"`) but is not recommended.

> Note: some nmap SYN internals may still want the capability on the *node*
> binary in unusual setups. If SYN scans still fail after the above, either run
> the service as root or rely on the automatic `-sT` fallback (works unprivileged).

## 3. Optional: better vuln detection scripts

The scanner prefers the `vulners` NSE script (fast, CVE-rich) and detects whether
it is installed. It ships with modern nmap; if missing, the scanner falls back to
the built-in `vuln` category. To add `vulners`/`vulscan` manually:

```bash
# vulners (usually already present)
sudo nmap --script-help vulners >/dev/null 2>&1 && echo "vulners present"
```

## 4. Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NMAP_PATH` | (auto) | Full path to nmap when not on PATH |
| `MAX_CONCURRENT_SCANS` | `3` | Concurrent scan cap |
| `SCAN_ONLINE_ENRICHMENT` | `true` | Set `false` on air-gapped boxes to skip NVD/CIRCL/EPSS/KEV lookups (scan still runs off the local KB) |
| `NVD_API_KEY` | — | Raises NVD rate limits for CPE lookups |
| `REDIS_URL` | — | Optional shared cache for CVE lookups (safe to omit) |

## 5. Verifying on the box

```bash
# capability probe only
node -e 'require("./services/scannerService").probeCapabilities().then(c=>console.log(c))'

# real scan of a known host (replace IP)
node -e 'require("./services/scannerService").runNmapScan("192.0.2.10",{scanType:"quick",onProgress:(p,m)=>console.log(p,m)}).then(r=>console.log(r.length,"ports")).catch(e=>console.error(e.message))'
```

Expect: capability probe prints `nmapAvailable:true` and a privilege method; the
scan streams progress 0→100 and returns port rows in seconds (not minutes). If it
hangs or errors, re-check steps 1–2 and the `/api/scan/progress` warnings array.
