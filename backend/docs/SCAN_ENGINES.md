# Optional scan engines (Nessus / OpenVAS)

nmap is the built-in engine and always available. Nessus and OpenVAS/Greenbone are **optional** — they
appear in the scan-engine picker only when configured, and if a chosen engine is unconfigured or
unreachable the scan **automatically falls back to nmap**. `GET /api/scan/engines` reports availability.

Both produce vulnerability findings directly, which are saved onto the target as Vulnerabilities (with
compliance tags + risk scoring), de-duplicated like the multi-tool import.

## Nessus (Tenable) — REST API

Set in `backend/.env`:

```bash
NESSUS_URL=https://your-nessus-host:8834
NESSUS_ACCESS_KEY=<access key>
NESSUS_SECRET_KEY=<secret key>
# optional: pin a scan template, else the "basic"/"advanced" template is auto-selected
NESSUS_POLICY_UUID=
```

Get API keys in Nessus under **Settings → My Account → API Keys**. The adapter creates a scan targeting
the asset IP, launches it, polls to completion, exports `.nessus`, and imports the findings.

## OpenVAS / Greenbone — GMP via gvm-cli (experimental)

Requires **gvm-tools** (`gvm-cli`) installed on the CamtelVM server and reachable GVM credentials.

```bash
# connect over a unix socket …
GVM_SOCKET=/run/gvmd/gvmd.sock
# … or over TLS
GVM_HOST=your-gvm-host
GVM_PORT=9390
GVM_USER=admin
GVM_PASSWORD=<password>
# optional overrides (defaults = "Full and fast" config + OpenVAS Default scanner)
GVM_SCAN_CONFIG=daba56c8-73ec-11df-a475-002264764cea
GVM_SCANNER=08b69003-5fc2-4037-a479-93b440211c73
```

The adapter creates a target + task, starts it, polls to `Done`, fetches the XML report and imports the
findings. If `gvm-cli` isn't installed it reports the engine unavailable — use the PDF/XML **Import**
feature on the Vulnerabilities page instead.

## Notes
- Real Nessus/OpenVAS scans take minutes; progress is streamed over the same WebSocket as nmap.
- TLS verification is relaxed for the Nessus API (self-signed appliance certs are common). Restrict
  access to the Nessus host at the network layer.
