// import React, { useState, useEffect, useContext } from 'react';
// import {
//   Table, Button, Modal, Form, Alert, Spinner, Badge, Dropdown, Pagination, Row, Col, Card, ProgressBar, ButtonGroup
// } from 'react-bootstrap';
// import { AuthContext } from '../context/AuthContext';
// import {
//   FaEdit, FaTrash, FaPlus, FaSyncAlt, FaBug, FaDownload, FaSort, FaNetworkWired, FaShieldAlt, FaExclamationTriangle, FaCheckCircle, FaSearch, FaServer
// } from 'react-icons/fa';
// import Select from 'react-select';
// import Papa from 'papaparse'; // For CSV Export
// import '../App.css'
// import config from '../config';
// import { useSocket } from '../context/SocketContext';
// import ScanProgressBar from '../components/ScanProgressBar';
// import { useScan } from '../context/ScanContext'; // Add this
// import { useConnectivity } from '../hooks/useConnectivity';



// const assetTypes = ['Server', 'Database', 'Application', 'Network Device'];
// const serverStatuses = ['Online', 'Offline', 'Maintenance'];
// const serverTypes = ['Physical', 'Virtual'];
// const serverStates = ['Active', 'Passive'];
// const serverExposures = ['Public', 'Private'];
// const dbOptions = ['MySQL 8.0', 'PostgreSQL 13', 'MongoDB 5.0', 'Oracle 19c'];
// const webServerOptions = ['Apache 2.4', 'Nginx 1.18', 'IIS 10'];
// const osOptions = ['Windows 10', 'Ubuntu 22.04', 'macOS 13 Ventura', 'RedHat 9', 'CentOS 7'];

// // Enhanced scan types
// const scanTypes = [
//   { value: 'quick', label: 'Quick Scan (Top 100 ports)', description: 'Fast scan for regular monitoring' },
//   { value: 'comprehensive', label: 'Comprehensive Scan (All ports)', description: 'Thorough assessment with OS detection' },
//   { value: 'stealth', label: 'Stealth Scan', description: 'Slow, evasive scan to avoid detection' },
//   { value: 'vulnerability', label: 'Vulnerability Scan', description: 'Focused security assessment' },
//   { value: 'udp', label: 'UDP Scan', description: 'UDP service discovery' }
// ];

// const Servers = () => {
//   const { token } = useContext(AuthContext);

//   const { isConnected, scanProgress, resetScanProgress, showScanResults  } = useSocket(token);

//     // Use scan context instead of local state
//   const {
//     scanningTargetId,
//     scanningAll,
//     startScan,
//     scanAllTargets,
//     batchScan,
//     showScanOptions,
//     addNotification,
//   } = useScan();

//   // const {
//   //   // connectivity,
//   //   // testConnectivity,
//   //   // isTestingConnectivity
//   // } = useConnectivity();

//   const [assets, setAssets] = useState([]);
//   const [filteredAssets, setFilteredAssets] = useState([]);
//   const [showModal, setShowModal] = useState(false);
//   const [isEditing, setIsEditing] = useState(false);
//   const [currentAsset, setCurrentAsset] = useState({});
//   const [editId, setEditId] = useState(null);

//   const [form, setForm] = useState({
//     name: '',
//     ip: '',
//     type: 'Server',
//     serverType: 'Physical',
//     manufacturer: '',
//     model: '',
//     dbType: '',
//     wsType: '',
//     os: '',
//     osVersion: '',
//     status: 'Online',
//     memory: '',
//     diskSpace: '',
//     cpuCapacity: '',
//     hostDepartment: '',
//     serverAdministrator: '',
//     description: '',
//     state: 'Active',
//     exposure: 'Private',
//     activeProtocols: ['HTTP', 'HTTPS'],
//     owner: ''
//   });

//   // Enhanced scan state
//   // const [scanResults, setScanResults] = useState([]);
//   const [vulns, setVulns] = useState([]);
//   const [sortField, setSortField] = useState('');
//   const [statusFilter, setStatusFilter] = useState('');
//   const [typeFilter, setTypeFilter] = useState('');
//   const [serverTypeFilter, setServerTypeFilter] = useState('');
//   // const [showScanModal, setShowScanModal] = useState(false);
//   // const [showScanOptionsModal, setShowScanOptionsModal] = useState(false);
//   // const [selectedAssetForScan, setSelectedAssetForScan] = useState(null);
//   // const [selectedScanType, setSelectedScanType] = useState('quick');
//   // const [scannedAssetName, setScannedAssetName] = useState('');
//   // const [scanningAssetId, setScanningAssetId] = useState(null);
//   // const [scanningAll, setScanningAll] = useState(false);
//   // const [scanProgress, setScanProgress] = useState({ percent: 0, message: `Starting ${selectedScanType} scan for ${scannedAssetName}...`, active: false });
//   const [connectivity, setConnectivity] = useState({});
//   const [testingConnectivity, setTestingConnectivity] = useState(new Set());
//   // const scanProgress = socketScanProgress;

//   // ... existing state variables ...
//   const [searchTerm, setSearchTerm] = useState('');
//   const [sortBy, setSortBy] = useState('name');
//   const [sortOrder, setSortOrder] = useState('asc');
//   const [currentPage, setCurrentPage] = useState(1);
//   const [itemsPerPage] = useState(10);
//   const [success, setSuccess] = useState('');
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(true);
//   const [vulnCountMap, setVulnCountMap] = useState({}); // new

//     // Simplified scan function - uses context
//   const handleScan = (asset) => {
//     startScan(asset, 'quick');
//   };

//     // Simplified scan all - uses context
//   const handleScanAll = async () => {
//     const confirmed = window.confirm('Run quick scan for all online assets?');
//     if (!confirmed) return; 
//     await scanAllTargets();
//   };

//     // Simplified connectivity test
//   // const handleTestConnectivity = async (asset) => {
//   //   const result = await testConnectivity(asset);
//   //   if (result.success) {
//   //     // Update local connectivity state if needed
//   //     setConnectivity(prev => ({
//   //       ...prev,
//   //       [asset._id]: { 
//   //         reachable: result.reachable, 
//   //         testedAt: result.testedAt 
//   //       }
//   //     }));
//   //   }
//   // };

//   const openCreateModal = () => {
//     setForm({
//       name: '',
//       ip: '',
//       type: 'Server',
//       serverType: 'Physical',
//       manufacturer: '',
//       model: '',
//       os: '',
//       osVersion: '',
//       status: 'Online',
//       memory: '',
//       diskSpace: '',
//       cpuCapacity: '',
//       hostDepartment: '',
//       serverAdministrator: '',
//       description: '',
//       owner: '',
//       state: 'Active',
//       exposure: 'Private',
//       activeProtocols: [''],
//       dbType: '',
//       wsType: ''
//     });
//     setIsEditing(false);
//     setShowModal(true);
//   };

//   const handleChange = e =>
//     setForm({ ...form, [e.target.name]: e.target.value });

//   const openEditModal = asset => {
//     setForm({ ...asset });
//     setEditId(asset._id);
//     setIsEditing(true);
//     setShowModal(true);
//   };

//   const handleSubmit = async e => {
//     e.preventDefault();
//     try {
//       const method = isEditing ? 'PUT' : 'POST';
//       const url = isEditing
//         ? `${config.API_BASE_URL}/api/assets/${editId}`
//         : `${config.API_BASE_URL}/api/assets`;

//       await fetch(url, {
//         method,
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify(form),
//       });

//       fetchAssets();
//       setShowModal(false);
//     } catch (error) {
//       console.error('Failed to save asset', error);
//     }
//   };

//   const handleDelete = async id => {
//     const confirmed = window.confirm('Are you sure you want to delete this asset?');
//     if (!confirmed) return;

//     try {
//       await fetch(`${config.API_BASE_URL}/api/assets/${id}`, {
//         method: 'DELETE',
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       fetchAssets();
//     } catch (error) {
//       console.error('Failed to delete asset', error);
//     }
//   };

//   // Fetch assets with enhanced data
//   const fetchAssets = async () => {
//     setLoading(true);
//     try {
//       const res = await fetch(`${config.API_BASE_URL}/api/assets`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();

//     const normalizedData = data.map(asset => ({
//       ...asset,
//       targetType: 'asset'
//     }));

//       setAssets(normalizedData);
//       setFilteredAssets(normalizedData);
//     } catch (err) {
//       console.error('Failed to fetch assets', err);
//       setError('Failed to load assets');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchVulnerabilities = async () => {
//     try {
//       const res = await fetch(`${config.API_BASE_URL}/api/vulnerabilities`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       const list = Array.isArray(data) ? data : [];

//       setVulns(list);

//       // build map: assetId (string) -> open vuln count
//       const map = {};
//       list.forEach(v => {
//         console.log("Fetched vulnerabilities:", v);
//         if (!v.asset?._id) return;
//         if (v.status === 'Open') {
//           map[v.asset._id] = (map[v.asset._id] || 0) + 1;
//         }
//       });

//       setVulnCountMap(map);
//     } catch (err) {
//       console.error('Failed to fetch vulnerabilities', err);
//       setVulns([]);
//       setVulnCountMap({});
//     }
//   };

//     // Get vulnerability count for asset (you might want to fetch this separately)
//   const getVulnerabilityCount = (asset) => {
//     // This would typically come from a separate API call
//     // For now, return a placeholder
//     // Replace with actual data
//     // return Math.floor(Math.random() * 10); 

//     if (!asset) return 0;
//     return vulnCountMap[String(asset._id)] || 0;
//   }

//   useEffect(() => {
//     fetchAssets();
//     fetchVulnerabilities();
//   }, [token]);

//   // Enhanced single asset scan with options
// //   const startScan = async (asset, scanType = 'quick') => {
// //   const { _id, name } = asset;
// //   setScanningAssetId(_id);
// //   setError('');
// //   setSuccess('');
// //   setScanResults([]);
// //   resetScanProgress();
// //   // setScanProgress({ percent: 0, message: `Starting ${scanType} scan for ${name}...`, active: true });

// //   try {
// //     const res = await fetch(`${config.API_BASE_URL}/api/scan/asset`, {
// //       method: 'POST',
// //       headers: {
// //         'Content-Type': 'application/json',
// //         Authorization: `Bearer ${token}`,
// //       },
// //       body: JSON.stringify({ assetId: _id, scanType }),
// //     });

// //     const data = await res.json();

// //     if (data.success) {
// //       setScannedAssetName(name);
      
// //       // CRITICAL: Ensure all scan results are properly formatted
// //       const formattedResults = (data.scanResults || []).map(result => ({
// //         ...result,
// //         // Ensure vulnerabilities is always an array
// //         vulnerabilities: Array.isArray(result.vulnerabilities) ? 
// //           result.vulnerabilities.map(vuln => {
// //             // If vulnerability is already a string, keep it
// //             if (typeof vuln === 'string') return vuln;
            
// //             // If it's an object, ensure we have string representations
// //             if (typeof vuln === 'object' && vuln !== null) {
// //               return {
// //                 ...vuln,
// //                 title: String(vuln.title || vuln.cve || vuln.name || 'Unknown'),
// //                 severity: String(vuln.severity || 'Unknown'),
// //                 cve: String(vuln.cve || ''),
// //                 cvssScore: vuln.cvssScore ? Number(vuln.cvssScore) : 0
// //               };
// //             }
            
// //             return 'Unknown Vulnerability';
// //           }) : []
// //       }));
      
// //       setScanResults(formattedResults);
// //       setSuccess(`${scanType.charAt(0).toUpperCase() + scanType.slice(1)} scan completed successfully. Found ${data.newVulnerabilities || 0} new vulnerabilities.`);
// //       setShowScanModal(true);
      
// //       // Refresh both assets and vulnerabilities
// //       fetchAssets();
// //       fetchVulnerabilities();
// //     } else {
// //       setError(data.message || 'Scan failed');
// //     }
// //   } catch (err) {
// //     console.error('Scan failed', err);
// //     setError('Scan failed due to server error.');
// //   } finally {
// //     setScanningAssetId(null);
// //     // setScanProgress({ percent: 100, message: 'Scan completed', active: false });
// //   }
// // };
//   // const startScan = async (asset, scanType = 'quick') => {
//   //   const { _id, name } = asset;
//   //   setScanningAssetId(_id);
//   //   setError('');
//   //   setSuccess('');
//   //   setScanResults([]);
//   //   setScanProgress({ percent: 0, message: `Starting ${scanType} scan for ${name}...`, active: true });

//   //   try {
//   //     const res = await fetch(`${config.API_BASE_URL}/api/scan/asset`, {
//   //       method: 'POST',
//   //       headers: {
//   //         'Content-Type': 'application/json',
//   //         Authorization: `Bearer ${token}`,
//   //       },
//   //       body: JSON.stringify({ assetId: _id, scanType }),
//   //     });

//   //     const data = await res.json();

//   //     if (data.success) {
//   //       setScannedAssetName(name);
//   //       // Ensure scanResults is always an array and vulnerabilities are properly formatted
//   //       const formattedResults = (data.scanResults || []).map(result => ({
//   //         ...result,
//   //         vulnerabilities: Array.isArray(result.vulnerabilities) ? result.vulnerabilities : []
//   //       }));
//   //       setScanResults(formattedResults);
//   //       // setScanResults(data.scanResults || []);
//   //       setSuccess(`${scanType.charAt(0).toUpperCase() + scanType.slice(1)} scan completed successfully. Found ${data.newVulnerabilities || 0} new vulnerabilities.`);
//   //       setShowScanModal(true);
        
//   //       // Refresh assets to update last scan date
//   //       fetchAssets();
//   //     } else {
//   //       setError(data.message || 'Scan failed');
//   //     }
//   //   } catch (err) {
//   //     console.error('Scan failed', err);
//   //     setError('Scan failed due to server error.');
//   //   } finally {
//   //     setScanningAssetId(null);
//   //     setScanProgress({ percent: 100, message: 'Scan completed', active: false });
//   //   }
//   // };

//   // Test asset connectivity
//   const testConnectivity = async (asset) => {
//     const { _id } = asset;
//     setTestingConnectivity(prev => new Set([...prev, _id]));

//     try {
//       const res = await fetch(`${config.API_BASE_URL}/api/scan/test/${_id}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();

//       if (data.success) {
//         setConnectivity(prev => ({
//           ...prev,
//           [_id]: { reachable: data.reachable, testedAt: data.testedAt }
//         }));
//       }
//     } catch (err) {
//       console.error('Connectivity test failed', err);
//       setConnectivity(prev => ({
//         ...prev,
//         [_id]: { reachable: false, testedAt: new Date() }
//       }));
//     } finally {
//       setTestingConnectivity(prev => {
//         const newSet = new Set(prev);
//         newSet.delete(_id);
//         return newSet;
//       });
//     }
//   };

//   // Enhanced quick scan for all assets
//   // const scanAllAssets = async () => {
//   //   const confirmed = window.confirm('Run quick scan for all online assets? This may take several minutes.');
//   //   if (!confirmed) return;

//   //   setScanningAll(true);
//   //   setError('');
//   //   setSuccess('');
//   //   resetScanProgress(); // Reset progress before starting
//   //   // setScanProgress({ percent: 0, message: 'Initializing quick scan for all assets...', active: true });

//   //   try {
//   //     const res = await fetch(`${config.API_BASE_URL}/api/scan/quick`, {
//   //       method: 'POST',
//   //       headers: { Authorization: `Bearer ${token}` },
//   //     });

//   //     const data = await res.json();

//   //     if (data.success) {
//   //       setSuccess(`Quick scan completed! Scanned ${data.summary.scannedAssets} assets and found ${data.summary.totalVulnerabilities} vulnerabilities.`);
//   //       fetchAssets(); // Refresh to show updated scan dates
//   //     } else {
//   //       setError(data.message || 'Quick scan failed');
//   //     }
//   //   } catch (err) {
//   //     console.error('Quick scan failed', err);
//   //     setError('Quick scan failed due to server error.');
//   //   } finally {
//   //     setScanningAll(false);
//   //     // setScanProgress({ percent: 100, message: 'Quick scan completed', active: false });
//   //   }
//   // };

//   // useEffect(() => {
//   //   return () => {
//   //     resetScanProgress();
//   //   };
//   // }, [resetScanProgress]);

//   // Batch scan for selected assets
//   // const batchScan = async (selectedAssetIds, scanType = 'quick') => {
//   //   if (selectedAssetIds.length === 0) {
//   //     setError('Please select assets to scan');
//   //     return;
//   //   }

//   //   const confirmed = window.confirm(`Run ${scanType} scan for ${selectedAssetIds.length} selected assets?`);
//   //   if (!confirmed) return;

//   //   setScanningAll(true);
//   //   setError('');
//   //   setSuccess('');
//   //   resetScanProgress();
//   //   // setScanProgress({ percent: 0, message: `Starting batch ${scanType} scan...`, active: true });

//   //   try {
//   //     const res = await fetch(`${config.API_BASE_URL}/api/scan/batch`, {
//   //       method: 'POST',
//   //       headers: {
//   //         'Content-Type': 'application/json',
//   //         Authorization: `Bearer ${token}`,
//   //       },
//   //       body: JSON.stringify({ assetIds: selectedAssetIds, scanType }),
//   //     });

//   //     const data = await res.json();

//   //     if (data.success) {
//   //       setSuccess(`Batch scan completed! Successfully scanned ${data.summary.successfulScans} assets.`);
//   //       if (data.summary.failedScans > 0) {
//   //         setError(`${data.summary.failedScans} assets failed to scan.`);
//   //       }
//   //       fetchAssets();
//   //     } else {
//   //       setError(data.message || 'Batch scan failed');
//   //     }
//   //   } catch (err) {
//   //     console.error('Batch scan failed', err);
//   //     setError('Batch scan failed due to server error.');
//   //   } finally {
//   //     setScanningAll(false);
//   //     // setScanProgress({ percent: 100, message: 'Batch scan completed', active: false });
//   //   }
//   // };

//   // Show scan options modal
//   // const showScanOptions = (asset) => {
//   //   setSelectedAssetForScan(asset);
//   //   setShowScanOptionsModal(true);
//   // };

//   // Execute scan with selected options
//   // const executeScan = () => {
//   //   if (selectedAssetForScan) {
//   //     startScan(selectedAssetForScan, selectedScanType);
//   //     setShowScanOptionsModal(false);
//   //   }
//   // };

//   // Get risk level badge
//   const getRiskBadge = (riskLevel) => {
//     const riskColors = {
//       'Critical': 'danger',
//       'High': 'warning',
//       'Medium': 'info',
//       'Low': 'success'
//     };
//     return <Badge bg={riskColors[riskLevel] || 'secondary'}>{riskLevel || 'Unknown'}</Badge>;
//   };

//   // Get connectivity status badge
//   const getConnectivityBadge = (asset) => {
//     const conn = connectivity[asset._id];
//     const isTesting = testingConnectivity.has(asset._id);

//     if (isTesting) {
//       return <Spinner size="sm" animation="border" />;
//     }

//     if (conn) {
//       return conn.reachable ? 
//         <Badge bg="success"><FaCheckCircle /> Online</Badge> :
//         <Badge bg="danger"><FaExclamationTriangle /> Offline</Badge>;
//     }

//     return <Button size="sm" variant="outline-secondary" onClick={() => testConnectivity(asset)}>
//       <FaSearch /> Test
//     </Button>;
//   };

// const applyFilters = () => {
//     let filtered = [...assets];

//     if (searchTerm) {
//       filtered = filtered.filter(asset =>
//         Object.values(asset).some(field =>
//           String(field).toLowerCase().includes(searchTerm.toLowerCase())
//         )
//       );
//     }

//     if (statusFilter) {
//       filtered = filtered.filter(asset => asset.status === statusFilter);
//     }

//     if (serverTypeFilter) {
//       filtered = filtered.filter(asset => asset.serverType === serverTypeFilter);
//     }

//     if (typeFilter) {
//       filtered = filtered.filter(asset => asset.type === typeFilter);
//     }

//     if (sortField) {
//       filtered.sort((a, b) =>
//         a[sortField]?.toLowerCase().localeCompare(b[sortField]?.toLowerCase())
//       );
//     }

//     setFilteredAssets(filtered);
//   };

//   useEffect(() => {
//     applyFilters();
//     setCurrentPage(1); // Reset to first page on filters change
//   }, [searchTerm, statusFilter, typeFilter, sortField, assets]);

//   const exportToCSV = () => {
//     const csv = Papa.unparse(filteredAssets);
//     const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
//     const link = document.createElement('a');
//     link.href = URL.createObjectURL(blob);
//     link.setAttribute('download', 'assets_export.csv');
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };
  
//   // Filter and sort assets
//   useEffect(() => {
//     let filtered = assets.filter(asset =>
//       Object.values(asset).some(value =>
//         String(value).toLowerCase().includes(searchTerm.toLowerCase())
//       )
//     );

//     // Sort assets
//     filtered.sort((a, b) => {
//       const aVal = a[sortBy] || '';
//       const bVal = b[sortBy] || '';
//       if (sortOrder === 'asc') {
//         return aVal.toString().localeCompare(bVal.toString());
//       } else {
//         return bVal.toString().localeCompare(aVal.toString());
//       }
//     });

//     setFilteredAssets(filtered);
//     setCurrentPage(1);
//   }, [assets, searchTerm, sortBy, sortOrder]);

//   // Pagination
//   const indexOfLastItem = currentPage * itemsPerPage;
//   const indexOfFirstItem = indexOfLastItem - itemsPerPage;
//   const currentAssets = filteredAssets.slice(indexOfFirstItem, indexOfLastItem);
//   const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);

//   if (loading) {
//     return (
//       <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
//         <Spinner animation="border" role="status">
//           <span className="visually-hidden">Loading...</span>
//         </Spinner>
//       </div>
//     );
//   }


//   return (
//     <div className="vm-page-shell">
//       {/* ADD THIS: Real-time Scan Progress Bar */}
//       {/* <ScanProgressBar 
//         scanProgress={scanProgress} 
//         show={scanProgress.active || scanProgress.percent > 0}
//       /> */}

//       {/* Socket Connection Status (optional - for debugging) */}
//       {/* {!isConnected && (
//         <Alert variant="warning" className="mb-3">
//           <small>⚠️ Real-time updates disconnected. Progress may not update live.</small>
//         </Alert>
//       )} */}

//       {/* Header Section */}
//       <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
//         <h3 className="vm-page-title"><FaServer />{t('Server Assets')}</h3>
//         <div className="d-flex gap-2 flex-wrap">
//           <ButtonGroup>
//             <Button style={{ backgroundColor: '#1594EA' }} onClick={() => openCreateModal(true)}>
//               <FaPlus /> Add New
//             </Button>
//             <Button 
//               variant="success" 
//               onClick={handleScanAll}
//               disabled={scanningAll || scanProgress.active}
//             >
//               {scanningAll ? (
//                 <>
//                   <Spinner size="sm" animation="border" /> Scanning All...
//                 </>
//               ) : (
//                 <>
//                   <FaSyncAlt /> Quick Scan All
//                 </>
//               )}
//             </Button>
//           </ButtonGroup>
//         </div>
//       </div>

//       <div className="mb-3">
//         <Badge bg={isConnected ? 'success' : 'danger'}>
//           {isConnected ? '● Connected' : '● Disconnected'}
//         </Badge>
//         {scanProgress.active && (
//           <Badge bg="info" className="ms-2">
//             <FaSyncAlt className="spin me-1" />
//             Scan in Progress
//           </Badge>
//         )}
//       </div>

//       {/* Alert Messages */}
//       {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
//       {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

//       {/* Scan Progress */}
//       {scanProgress.active && (
//         <Card className="mb-4">
//           <Card.Body>
//             <div className="d-flex justify-content-between align-items-center mb-2">
//               <strong>Scan Progress</strong>
//               <Badge bg="info">{scanProgress.percent}%</Badge>
//             </div>
//             <ProgressBar 
//               now={scanProgress.percent} 
//               animated={scanProgress.active}
//               variant={scanProgress.percent === 100 ? 'success' : 'info'}
//             />
//             <small className="text-muted mt-1 d-block">{scanProgress.message}</small>
//           </Card.Body>
//         </Card>
//       )}

//       {/* Search & Filter Bar */}
//       <div className="d-flex flex-wrap gap-2 mb-3">
//         <Form.Control
//           type="search"
//           placeholder="Search assets..."
//           value={searchTerm}
//           onChange={e => setSearchTerm(e.target.value)}
//           style={{ maxWidth: '250px' }}
//         />
//         <Form.Select
//           value={statusFilter}
//           onChange={e => setStatusFilter(e.target.value)}
//           style={{ maxWidth: '180px' }}
//         >
//           <option value="">All Statuses</option>
//           {serverStatuses.map(status => (
//             <option key={status} value={status}>
//               {status}
//             </option>
//           ))}
//         </Form.Select>
//         <Form.Select
//           value={serverTypeFilter}
//           onChange={e => setServerTypeFilter(e.target.value)}
//           style={{ maxWidth: '180px' }}
//         >
//           <option value="">All Server Types</option>
//           {serverTypes.map(type => (
//             <option key={type} value={type}>
//               {type}
//             </option>
//           ))}
//         </Form.Select>
//         <Form.Select
//           value={typeFilter}
//           onChange={e => setTypeFilter(e.target.value)}
//           style={{ maxWidth: '180px' }}
//         >
//           <option value="">All Asset Types</option>
//           {assetTypes.map(type => (
//             <option key={type} value={type}>
//               {type}
//             </option>
//           ))}
//         </Form.Select>
//         <Dropdown>
//           <Dropdown.Toggle variant="outline-secondary" size="sm">
//             <FaSort /> Sort
//           </Dropdown.Toggle>
//           <Dropdown.Menu>
//             <Dropdown.Item onClick={() => setSortField('name')}>By Name</Dropdown.Item>
//             <Dropdown.Item onClick={() => setSortField('ip')}>By IP</Dropdown.Item>
//             <Dropdown.Item onClick={() => setSortField('status')}>By Status</Dropdown.Item>
//           </Dropdown.Menu>
//         </Dropdown>
//         <Button
//           size="sm"
//           variant="outline-success"
//           onClick={exportToCSV}
//           className="d-flex align-items-center gap-1"
//         >
//           <FaDownload /> Export CSV
//         </Button>
//         <Button
//           size="sm"
//           variant="outline-info"
//           onClick={fetchAssets}
//           className="d-flex align-items-center gap-1"
//         >
//           <FaSyncAlt /> Refresh
//         </Button>
//       </div>

//       {/* Assets Table */}
//       <Card>
//         <Card.Body>
//           <Table responsive hover>
//             <thead>
//               <tr>
//                 <th>Name</th>
//                 <th>IP Address</th>
//                 <th>Type</th>
//                 <th>Status</th>
//                 <th>Connectivity</th>
//                 <th>Vulnerabilities</th>
//                 <th>Last Scan</th>
//                 <th>Risk Level</th>
//                 <th>Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {currentAssets.map((asset) => (
//                 <tr key={asset._id}>
//                   <td>
//                     <strong>{asset.name}</strong>
//                     {asset.description && (
//                       <div className="text-muted small">{asset.description}</div>
//                     )}
//                   </td>
//                   <td>
//                     <code>{asset.ip}</code>
//                     {asset.manufacturer && (
//                       <div className="text-muted small">{asset.manufacturer} {asset.model}</div>
//                     )}
//                   </td>
//                   <td>
//                     <Badge bg="info">{asset.type}</Badge>
//                     {asset.serverType && (
//                       <div className="text-muted small">{asset.serverType}</div>
//                     )}
//                   </td>
//                   <td>
//                     <Badge bg={asset.status === 'Online' ? 'success' : asset.status === 'Offline' ? 'danger' : 'warning'}>
//                       {asset.status}
//                     </Badge>
//                   </td>
//                   <td>{getConnectivityBadge(asset)}</td>
//                   <td>
//                     <Badge bg="warning">{getVulnerabilityCount(asset)}</Badge>
//                   </td>
//                   <td>
//                     {asset.lastScanDate ? (
//                       <small>{new Date(asset.lastScanDate).toLocaleDateString()}</small>
//                     ) : (
//                       <small className="text-muted">Never scanned</small>
//                     )}
//                   </td>
//                   <td>{getRiskBadge('Medium')}</td> {/* Replace with actual risk calculation */}
//                   <td>
//                     <ButtonGroup size="sm">
//                       <Button
//                         style={{
//                           borderColor: '#1594EA',
//                           color: '#1594EA',
//                         }} 
//                         className="d-flex align-items-center gap-1 edit-btn"
//                         variant="outline-primary"
//                         onClick={() => showScanOptions(asset)}
//                         disabled={scanningTargetId === asset._id || scanProgress.active}
//                       >
//                         {scanningTargetId === asset._id ? (
//                           <>
//                             <Spinner size="sm" animation="border" /> Scanning...
//                           </>
//                         ) : (
//                           <>
//                             <FaBug /> Scan
//                           </>
//                         )}
//                       </Button>
//                       <Button variant="outline-secondary" onClick={() => openEditModal(asset)}>
//                         <FaEdit />
//                       </Button>
//                       <Button variant="outline-danger" onClick={() => handleDelete(asset._id)}>
//                         <FaTrash />
//                       </Button>
//                     </ButtonGroup>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </Table>

//           {/* Pagination */}
//           <div className="d-flex justify-content-between align-items-center mt-3">
//             <div>
//               Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredAssets.length)} of {filteredAssets.length} assets
//             </div>
//             <Pagination>
//               <Pagination.Prev 
//                 disabled={currentPage === 1}
//                 onClick={() => setCurrentPage(currentPage - 1)}
//               />
//               {[...Array(totalPages)].map((_, index) => (
//                 <Pagination.Item
//                   key={index + 1}
//                   active={index + 1 === currentPage}
//                   onClick={() => setCurrentPage(index + 1)}
//                 >
//                   {index + 1}
//                 </Pagination.Item>
//               ))}
//               <Pagination.Next
//                 disabled={currentPage === totalPages}
//                 onClick={() => setCurrentPage(currentPage + 1)}
//               />
//             </Pagination>
//           </div>
//         </Card.Body>
//       </Card>

//       {/* Scan Options Modal */}
//       {/* <Modal show={showScanOptionsModal} onHide={() => setShowScanOptionsModal(false)}>
//         <Modal.Header closeButton>
//           <Modal.Title>
//             <FaBug className="me-2" />
//             Scan Options for {selectedAssetForScan?.name}
//           </Modal.Title>
//         </Modal.Header>
//         <Modal.Body>
//           <Form.Group className="mb-3">
//             <Form.Label>Select Scan Type</Form.Label>
//             <Form.Select
//               value={selectedScanType}
//               onChange={(e) => setSelectedScanType(e.target.value)}
//             >
//               {scanTypes.map(type => (
//                 <option key={type.value} value={type.value}>
//                   {type.label}
//                 </option>
//               ))}
//             </Form.Select>
//             <Form.Text className="text-muted">
//               {scanTypes.find(t => t.value === selectedScanType)?.description}
//             </Form.Text>
//           </Form.Group>

//           <Alert variant="info">
//             <FaShieldAlt className="me-2" />
//             <strong>Security Note:</strong> Vulnerability scans may be detected by security systems. 
//             Use stealth scans in sensitive environments.
//           </Alert>
//         </Modal.Body>
//         <Modal.Footer>
//           <Button variant="secondary" onClick={() => setShowScanOptionsModal(false)}>
//             Cancel
//           </Button>
//           <Button variant="primary" onClick={executeScan}>
//             <FaBug className="me-2" />
//             Start {scanTypes.find(t => t.value === selectedScanType)?.label}
//           </Button>
//         </Modal.Footer>
//       </Modal> */}

//       {/* Enhanced Scan Results Modal */}
//       {/* <Modal show={showScanModal} onHide={() => setShowScanModal(false)} size="xl">
//         <Modal.Header closeButton>
//           <Modal.Title>
//             <FaShieldAlt className="me-2" />
//             Scan Results for {scannedAssetName}
//           </Modal.Title>
//         </Modal.Header>
//         <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
//           {scanResults.length === 0 ? (
//             <Alert variant="info">
//               <FaCheckCircle className="me-2" />
//               No open ports or services detected.
//             </Alert>
//           ) : (
//             <>
//               <Alert variant="success" className="mb-3">
//                 <FaCheckCircle className="me-2" />
//                 Scan completed successfully! Found {scanResults.length} open ports.
//               </Alert>
              
//               <Table responsive striped>
//                 <thead>
//                   <tr>
//                     <th>Port</th>
//                     <th>Protocol</th>
//                     <th>State</th>
//                     <th>Service</th>
//                     <th>Product</th>
//                     <th>Version</th>
//                     <th>Vulnerabilities</th>
//                     <th>Risk Score</th>
//                     <th>Confidence</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {scanResults.map((result, idx) => (
//                     <tr key={idx}>
//                       <td><code>{result.port}</code></td>
//                       <td>{result.protocol}</td>
//                       <td>
//                         <Badge bg={result.state === 'open' ? 'success' : 'secondary'}>
//                           {result.state}
//                         </Badge>
//                       </td>
//                       <td>{result.service}</td>
//                       <td>{result.product || '-'}</td>
//                       <td>{result.version || '-'}</td>
//                       <td>
//                         {result.vulnerabilities?.length > 0 ? (
//                           <Badge bg="warning">
//                             {result.vulnerabilities.length} found
//                           </Badge>
//                         ) : (
//                           <Badge bg="success">None</Badge>
//                         )}
//                       </td>
//                       <td>
//                         <Badge bg={
//                           result.vulnerabilityScore >= 8 ? 'danger' :
//                           result.vulnerabilityScore >= 5 ? 'warning' :
//                           result.vulnerabilityScore > 0 ? 'info' : 'success'
//                         }>
//                           {result.vulnerabilityScore?.toFixed(1) || '0.0'}
//                         </Badge>
//                       </td>
//                       <td>
//                         <Badge bg="info">{result.confidence || 0}%</Badge>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </Table> */}

//               {/* Vulnerability Details */}
//               {/* {scanResults.some(r => r.vulnerabilities && Array.isArray(r.vulnerabilities) && r.vulnerabilities.length > 0) && (
//                 <div className="mt-4">
//                   <h5><FaExclamationTriangle className="me-2 text-warning" />Detected Vulnerabilities</h5>
//                   {scanResults
//                     .filter(r => r.vulnerabilities && Array.isArray(r.vulnerabilities) && r.vulnerabilities.length > 0)
//                     .map((result, idx) => (
//                       <Card key={idx} className="mb-2">
//                         <Card.Header>
//                           <strong>Port {result.port} - {result.service}</strong>
//                         </Card.Header>
//                         <Card.Body>
//                           <ul className="mb-0">
//                             {result.vulnerabilities.map((vuln, vIdx) => (
//                               <li key={vIdx} className="text-warning">
//                                 <strong>
//                                   {typeof vuln === 'string' ? vuln : 
//                                   (vuln?.title || vuln?.cve || vuln?.name || 'Unknown Vulnerability')}
//                                 </strong>
//                                 {typeof vuln === 'object' && vuln?.severity && (
//                                   <Badge bg={
//                                     vuln.severity === 'Critical' ? 'danger' :
//                                     vuln.severity === 'High' ? 'warning' :
//                                     vuln.severity === 'Medium' ? 'info' : 'success'
//                                   } className="ms-2">
//                                     {vuln.severity}
//                                   </Badge>
//                                 )}
//                                 {typeof vuln === 'object' && vuln?.cvssScore && (
//                                   <small className="text-muted ms-2">Score: {vuln.cvssScore}</small>
//                                 )}
//                               </li>
//                             ))}
//                           </ul>
//                         </Card.Body>
//                       </Card>
//                     ))}
//                 </div>
//               )}
//             </>
//           )}
//         </Modal.Body>
//         <Modal.Footer>
//           <Button variant="secondary" onClick={() => setShowScanModal(false)}>
//             Close
//           </Button>
//           <Button variant="primary" onClick={() => window.open('/vulnerabilities', '_blank')}>
//             <FaShieldAlt className="me-2" />
//             View All Vulnerabilities
//           </Button>
//         </Modal.Footer>
//       </Modal> */}

//       {/* Create/Edit Modal */}
//       <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
//         <Modal.Header
//           closeButton
//           style={{ backgroundColor: '#1594EA', color: '#fff' }}
//         >
//           <Modal.Title>{isEditing ? 'Edit Server Asset' : 'Add Server Asset'}</Modal.Title>
//         </Modal.Header>
//         <Modal.Body style={{ backgroundColor: '#F0F9FF' }}>
//           <Form onSubmit={handleSubmit}>
//             <Row>
//               <Col md={6}>
//                 {/* Left Form */}
//                 <Form.Group className="mb-3">
//                   <Form.Label>Name</Form.Label>
//                   <Form.Control name="name" value={form.name} onChange={handleChange} required />
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>IP Address</Form.Label>
//                   <Form.Control
//                     name="ip"
//                     type="text"
//                     value={form.ip}
//                     onChange={handleChange}
//                     pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
//                     title="Enter a valid IPv4 address"
//                     required
//                   />
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>Type</Form.Label>
//                   <Form.Select name="type" value={form.type} onChange={handleChange}>
//                     {assetTypes.map(type => (
//                       <option key={type} value={type}>
//                         {type}
//                       </option>
//                     ))}
//                   </Form.Select>
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>Server Type</Form.Label>
//                   <Form.Select name="serverType" value={form.serverType} onChange={handleChange}>
//                     {serverTypes.map(type => (
//                       <option key={type} value={type}>
//                         {type}
//                       </option>
//                     ))}
//                   </Form.Select>
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>Status</Form.Label>
//                   <Form.Select name="status" value={form.status} onChange={handleChange}>
//                     {serverStatuses.map(status => (
//                       <option key={status} value={status}>
//                         {status}
//                       </option>
//                     ))}
//                   </Form.Select>
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>Administrator</Form.Label>
//                   <Form.Control name="owner" value={form.owner} onChange={handleChange} />
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>State</Form.Label>
//                   <Form.Select name="state" value={form.state} onChange={handleChange}>
//                     {serverStates.map(state => (
//                       <option key={state} value={state}>
//                         {state}
//                       </option>
//                     ))}
//                   </Form.Select>
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>Exposure</Form.Label>
//                   <Form.Select name="exposure" value={form.exposure} onChange={handleChange}>
//                     {serverExposures.map(exposure => (
//                       <option key={exposure} value={exposure}>
//                         {exposure}
//                       </option>
//                     ))}
//                   </Form.Select>
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>Active Protocols</Form.Label>
//                   <Form.Control name="activeProtocols" value={form.activeProtocols} onChange={handleChange} />
//                 </Form.Group>
//               </Col>
//               <Col md={6}>
//                 {/* Right Form */}
//                 <Form.Group className="mb-3">
//                   <Form.Label>Manufacturer</Form.Label>
//                   <Form.Control name="manufacturer" value={form.manufacturer} onChange={handleChange} />
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>Model</Form.Label>
//                   <Form.Control name="model" value={form.model} onChange={handleChange} />
//                 </Form.Group>
//                 {/* <Form.Group>
//                   <Form.Label>Database Type & Version</Form.Label>
//                   <Form.Select name="dbopt" value={form.dbopt} onChange={handleChange}>
//                     <option value="">Select</option>
//                     {dbOptions.map(dbopt => (<option key={dbopt} value={dbopt}>{dbopt}</option>))}
//                   </Form.Select>
//                 </Form.Group>
//                 <Form.Group>
//                   <Form.Label>WebServer Type & Version</Form.Label>
//                   <Form.Select name="wsopt" value={form.wsopt} onChange={handleChange}>
//                     <option value="">Select</option>
//                     {webServerOptions.map(wsopt => <option key={wsopt} value={wsopt}>{wsopt}</option>)}
//                   </Form.Select>
//                 </Form.Group> */}
//                 <Form.Group className="mb-3">
//                   <Form.Label>Database Type & Version</Form.Label>
//                   {form && (
//                   <Form.Control
//                     type="text"
//                     list="dbVersionOptions"
//                     name="dbType"
//                     value={form.dbType || ''}
//                     onChange={handleChange}
//                     placeholder="Select or type Database Type & Version"
//                   />)}
//                   <datalist id="dbVersionOptions">
//                     {dbOptions.map(dbType => (<option key={dbType} value={dbType}>{dbType}</option>))}
//                   </datalist>
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>WebServer Type & Version</Form.Label>
//                   {form && (
//                   <Form.Control
//                     type="text"
//                     list="wsVersionOptions"
//                     name="wsType"
//                     value={form.wsType || ''}
//                     onChange={handleChange}
//                     placeholder="Select or type WebServer Type & Version"
//                   />)}
//                   <datalist id="wsVersionOptions">
//                     {webServerOptions.map(wsType => (<option key={wsType} value={wsType}>{wsType}</option>))}
//                   </datalist>
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>OS & Version</Form.Label>
//                   {form && (<Form.Control
//                     type="text"
//                     list="osVersionOptions"
//                     name="os"
//                     value={form.os}
//                     onChange={handleChange}
//                     placeholder="Select or type OS & Version"
//                   />)}
//                   <datalist id="osVersionOptions">
//                     {osOptions.map(os => (<option key={os} value={os}>{os}</option>))}
//                   </datalist>
//                 </Form.Group>
//                 {/* <Form.Group className="mb-3">
//                   <Form.Label>OS & Version</Form.Label>
//                   <Form.Control name="os" value={form.os} onChange={handleChange} />
//                 </Form.Group> */}
//                 {/* <Form.Group className="mb-3">
//                   <Form.Label>OS Version</Form.Label>
//                   <Form.Control name="osVersion" value={form.osVersion} onChange={handleChange} />
//                 </Form.Group> */}
//                 <Form.Group className="mb-3">
//                   <Form.Label>CPU Capacity</Form.Label>
//                   <Form.Control name="cpuCapacity" value={form.cpuCapacity} onChange={handleChange} />
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>Memory</Form.Label>
//                   <Form.Control name="memory" value={form.memory} onChange={handleChange} />
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>Disk Space</Form.Label>
//                   <Form.Control name="diskSpace" value={form.diskSpace} onChange={handleChange} />
//                 </Form.Group>
//                 <Form.Group className="mb-3">
//                   <Form.Label>Host Department</Form.Label>
//                   <Form.Control name="hostDepartment" value={form.hostDepartment} onChange={handleChange} />
//                 </Form.Group>
//               </Col>
//             </Row>
//             {console.log('Submitting form:', form)}
//             <div className="text-end">
//               <Button
//                 variant="secondary"
//                 onClick={() => setShowModal(false)}
//                 className="me-2"
//               >
//                 Cancel
//               </Button>
//               <Button
//                 style={{ backgroundColor: '#1594EA', border: 'none' }}
//                 type="submit"
//                 className=""
//               >
//                 {isEditing ? 'Update' : 'Add'}
//               </Button>
//             </div>
//           </Form>
//         </Modal.Body>
//       </Modal>
//     </div>
//   );
// };

// export default Servers;
import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import {
  Table, Button, Modal, Form, Alert, Spinner, Badge, Dropdown, Pagination, Row, Col, Card, ProgressBar, ButtonGroup
} from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import {
  FaEdit, FaTrash, FaPlus, FaSyncAlt, FaBug, FaDownload, FaSort, FaNetworkWired, FaShieldAlt, FaExclamationTriangle, FaCheckCircle, FaSearch, FaServer
} from 'react-icons/fa';
import Select from 'react-select';
import Papa from 'papaparse';
import '../App.css'
import config from '../config';
import { useSocket } from '../context/SocketContext';
import { useT } from '../context/LanguageContext';
import ScanProgressBar from '../components/ScanProgressBar';
import { useScan } from '../context/ScanContext';
import { useConnectivity } from '../hooks/useConnectivity';

const assetTypes = ['Server', 'Database', 'Application', 'Network Device'];
const serverStatuses = ['Online', 'Offline', 'Maintenance'];
const serverTypes = ['Physical', 'Virtual'];
const serverStates = ['Active', 'Passive'];
const serverExposures = ['Public', 'Private'];
const dbOptions = ['MySQL 8.0', 'PostgreSQL 13', 'MongoDB 5.0', 'Oracle 19c'];
const webServerOptions = ['Apache 2.4', 'Nginx 1.18', 'IIS 10'];
const osOptions = ['Windows 10', 'Ubuntu 22.04', 'macOS 13 Ventura', 'RedHat 9', 'CentOS 7'];

const scanTypes = [
  { value: 'quick', label: 'Quick Scan (Top 100 ports)', description: 'Fast scan for regular monitoring' },
  { value: 'comprehensive', label: 'Comprehensive Scan (All ports)', description: 'Thorough assessment with OS detection' },
  { value: 'stealth', label: 'Stealth Scan', description: 'Slow, evasive scan to avoid detection' },
  { value: 'vulnerability', label: 'Vulnerability Scan', description: 'Focused security assessment' },
  { value: 'udp', label: 'UDP Scan', description: 'UDP service discovery' }
];

const Servers = () => {
  const t = useT();
  const { token } = useContext(AuthContext);
  const { isConnected, scanProgress, resetScanProgress, showScanResults } = useSocket(token);

  const {
    scanningTargetId,
    scanningAll,
    startScan,
    scanAllTargets,
    batchScan,
    showScanOptions,
    addNotification,
  } = useScan();

  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentAsset, setCurrentAsset] = useState({});
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    ip: '',
    type: 'Server',
    serverType: 'Physical',
    manufacturer: '',
    model: '',
    dbType: '',
    wsType: '',
    os: '',
    osVersion: '',
    status: 'Online',
    memory: '',
    diskSpace: '',
    cpuCapacity: '',
    hostDepartment: '',
    serverAdministrator: '',
    description: '',
    state: 'Active',
    exposure: 'Private',
    activeProtocols: ['HTTP', 'HTTPS'],
    owner: ''
  });

  const [vulns, setVulns] = useState([]);
  const [sortField, setSortField] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [serverTypeFilter, setServerTypeFilter] = useState('');
  const [connectivity, setConnectivity] = useState({});
  const [testingConnectivity, setTestingConnectivity] = useState(new Set());

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [vulnCountMap, setVulnCountMap] = useState({});

  const handleScan = (asset) => {
    startScan(asset, 'quick');
  };

  const handleScanAll = async () => {
    const confirmed = window.confirm('Run quick scan for all online assets?');
    if (!confirmed) return; 
    await scanAllTargets();
  };

  const openCreateModal = () => {
    setForm({
      name: '',
      ip: '',
      type: 'Server',
      serverType: 'Physical',
      manufacturer: '',
      model: '',
      os: '',
      osVersion: '',
      status: 'Online',
      memory: '',
      diskSpace: '',
      cpuCapacity: '',
      hostDepartment: '',
      serverAdministrator: '',
      description: '',
      owner: '',
      state: 'Active',
      exposure: 'Private',
      activeProtocols: [''],
      dbType: '',
      wsType: ''
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const openEditModal = asset => {
    setForm({ ...asset });
    setEditId(asset._id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing
        ? `${config.API_BASE_URL}/api/assets/${editId}`
        : `${config.API_BASE_URL}/api/assets`;

      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      fetchAssets();
      setShowModal(false);
    } catch (error) {
      console.error('Failed to save asset', error);
    }
  };

  const handleDelete = async id => {
    const confirmed = window.confirm('Are you sure you want to delete this asset?');
    if (!confirmed) return;

    try {
      await fetch(`${config.API_BASE_URL}/api/assets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAssets();
    } catch (error) {
      console.error('Failed to delete asset', error);
    }
  };

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      const normalizedData = data.map(asset => ({
        ...asset,
        targetType: 'asset'
      }));

      setAssets(normalizedData);
      setFilteredAssets(normalizedData);
    } catch (err) {
      console.error('Failed to fetch assets', err);
      setError('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const fetchVulnerabilities = async () => {
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/vulnerabilities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

      setVulns(list);

      const map = {};
      list.forEach(v => {
        if (!v.asset?._id) return;
        if (v.status === 'Open') {
          map[v.asset._id] = (map[v.asset._id] || 0) + 1;
        }
      });

      setVulnCountMap(map);
    } catch (err) {
      console.error('Failed to fetch vulnerabilities', err);
      setVulns([]);
      setVulnCountMap({});
    }
  };

  const getVulnerabilityCount = (asset) => {
    if (!asset) return 0;
    return vulnCountMap[String(asset._id)] || 0;
  }

  useEffect(() => {
    fetchAssets();
    fetchVulnerabilities();
  }, [token]);

  const testConnectivity = async (asset) => {
    const { _id } = asset;
    setTestingConnectivity(prev => new Set([...prev, _id]));

    try {
      const res = await fetch(`${config.API_BASE_URL}/api/scan/test/${_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        setConnectivity(prev => ({
          ...prev,
          [_id]: { reachable: data.reachable, testedAt: data.testedAt }
        }));
      }
    } catch (err) {
      console.error('Connectivity test failed', err);
      setConnectivity(prev => ({
        ...prev,
        [_id]: { reachable: false, testedAt: new Date() }
      }));
    } finally {
      setTestingConnectivity(prev => {
        const newSet = new Set(prev);
        newSet.delete(_id);
        return newSet;
      });
    }
  };

  const getRiskBadge = (riskLevel) => {
    const riskColors = {
      'Critical': 'danger',
      'High': 'warning',
      'Medium': 'info',
      'Low': 'success'
    };
    return <Badge bg={riskColors[riskLevel] || 'secondary'}>{riskLevel || 'Unknown'}</Badge>;
  };

  const getConnectivityBadge = (asset) => {
    const conn = connectivity[asset._id];
    const isTesting = testingConnectivity.has(asset._id);

    if (isTesting) {
      return <Spinner size="sm" animation="border" />;
    }

    if (conn) {
      return conn.reachable ? 
        <Badge bg="success"><FaCheckCircle /> Online</Badge> :
        <Badge bg="danger"><FaExclamationTriangle /> Offline</Badge>;
    }

    return <Button size="sm" variant="outline-secondary" onClick={() => testConnectivity(asset)}>
      <FaSearch /> Test
    </Button>;
  };

  const applyFilters = () => {
    let filtered = [...assets];

    if (searchTerm) {
      filtered = filtered.filter(asset =>
        Object.values(asset).some(field =>
          String(field).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(asset => asset.status === statusFilter);
    }

    if (serverTypeFilter) {
      filtered = filtered.filter(asset => asset.serverType === serverTypeFilter);
    }

    if (typeFilter) {
      filtered = filtered.filter(asset => asset.type === typeFilter);
    }

    if (sortField) {
      filtered.sort((a, b) =>
        a[sortField]?.toLowerCase().localeCompare(b[sortField]?.toLowerCase())
      );
    }

    setFilteredAssets(filtered);
  };

  useEffect(() => {
    applyFilters();
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, sortField, assets]);

  const exportToCSV = () => {
    const csv = Papa.unparse(filteredAssets);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'assets_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  useEffect(() => {
    let filtered = assets.filter(asset =>
      Object.values(asset).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    filtered.sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      if (sortOrder === 'asc') {
        return aVal.toString().localeCompare(bVal.toString());
      } else {
        return bVal.toString().localeCompare(aVal.toString());
      }
    });

    setFilteredAssets(filtered);
    setCurrentPage(1);
  }, [assets, searchTerm, sortBy, sortOrder]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAssets = filteredAssets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 3) {
        endPage = 4;
      } else if (currentPage >= totalPages - 2) {
        startPage = totalPages - 3;
      }
      
      if (startPage > 2) {
        pages.push('...');
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div className="vm-page-shell">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
        <h3 className="vm-page-title"><FaServer />{t('Server Assets')}</h3>
        <div className="d-flex gap-2 flex-wrap">
          <ButtonGroup>
            <Button style={{ backgroundColor: '#1594EA' }} onClick={() => openCreateModal(true)}>
              <FaPlus /> Add New
            </Button>
            <Button 
              variant="success" 
              onClick={handleScanAll}
              disabled={scanningAll || scanProgress.active}
            >
              {scanningAll ? (
                <>
                  <Spinner size="sm" animation="border" /> Scanning All...
                </>
              ) : (
                <>
                  <FaSyncAlt /> Quick Scan All
                </>
              )}
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <div className="mb-3">
        <Badge bg={isConnected ? 'success' : 'danger'}>
          {isConnected ? '● Connected' : '● Disconnected'}
        </Badge>
        {scanProgress.active && (
          <Badge bg="info" className="ms-2">
            <FaSyncAlt className="spin me-1" />
            Scan in Progress
          </Badge>
        )}
      </div>

      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {scanProgress.active && (
        <Card className="mb-4">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong>Scan Progress</strong>
              <Badge bg="info">{scanProgress.percent}%</Badge>
            </div>
            <ProgressBar 
              now={scanProgress.percent} 
              animated={scanProgress.active}
              variant={scanProgress.percent === 100 ? 'success' : 'info'}
            />
            <small className="text-muted mt-1 d-block">{scanProgress.message}</small>
          </Card.Body>
        </Card>
      )}

      <div className="d-flex flex-wrap gap-2 mb-3">
        <Form.Control
          type="search"
          placeholder="Search assets..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ maxWidth: '250px' }}
        />
        <Form.Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ maxWidth: '180px' }}
        >
          <option value="">All Statuses</option>
          {serverStatuses.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Form.Select>
        <Form.Select
          value={serverTypeFilter}
          onChange={e => setServerTypeFilter(e.target.value)}
          style={{ maxWidth: '180px' }}
        >
          <option value="">All Server Types</option>
          {serverTypes.map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Form.Select>
        <Form.Select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{ maxWidth: '180px' }}
        >
          <option value="">All Asset Types</option>
          {assetTypes.map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Form.Select>
        <Form.Select
          value={itemsPerPage}
          onChange={e => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
          style={{ maxWidth: '120px' }}
        >
          <option value={5}>5 per page</option>
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </Form.Select>
        <Dropdown>
          <Dropdown.Toggle variant="outline-secondary" size="sm">
            <FaSort /> Sort
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => setSortField('name')}>By Name</Dropdown.Item>
            <Dropdown.Item onClick={() => setSortField('ip')}>By IP</Dropdown.Item>
            <Dropdown.Item onClick={() => setSortField('status')}>By Status</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        <Button
          size="sm"
          variant="outline-success"
          onClick={exportToCSV}
          className="d-flex align-items-center gap-1"
        >
          <FaDownload /> Export CSV
        </Button>
        <Button
          size="sm"
          variant="outline-info"
          onClick={fetchAssets}
          className="d-flex align-items-center gap-1"
        >
          <FaSyncAlt /> Refresh
        </Button>
      </div>

      <Card>
        <Card.Body>
          <Table responsive hover>
            <thead>
              <tr>
                <th>Name</th>
                <th>IP Address</th>
                <th>Type</th>
                <th>Status</th>
                <th>Connectivity</th>
                <th>Vulnerabilities</th>
                <th>Last Scan</th>
                <th>Risk Level</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentAssets.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center text-muted py-4">
                    No assets found
                  </td>
                </tr>
              ) : (
                currentAssets.map((asset) => (
                  <tr key={asset._id}>
                    <td>
                      <Link to={`/assets/${asset._id}`} className="vm-link" style={{ fontWeight: 700, color: 'var(--vm-text)', textDecoration: 'none' }} title="View asset details">
                        {asset.name}
                      </Link>
                      {asset.description && (
                        <div className="text-muted small">{asset.description}</div>
                      )}
                    </td>
                    <td>
                      <code>{asset.ip}</code>
                      {asset.manufacturer && (
                        <div className="text-muted small">{asset.manufacturer} {asset.model}</div>
                      )}
                    </td>
                    <td>
                      <Badge bg="info">{asset.type}</Badge>
                      {asset.serverType && (
                        <div className="text-muted small">{asset.serverType}</div>
                      )}
                    </td>
                    <td>
                      <Badge bg={asset.status === 'Online' ? 'success' : asset.status === 'Offline' ? 'danger' : 'warning'}>
                        {asset.status}
                      </Badge>
                    </td>
                    <td>{getConnectivityBadge(asset)}</td>
                    <td>
                      <Badge bg="warning">{getVulnerabilityCount(asset)}</Badge>
                    </td>
                    <td>
                      {asset.lastScanDate ? (
                        <small>{new Date(asset.lastScanDate).toLocaleDateString()}</small>
                      ) : (
                        <small className="text-muted">Never scanned</small>
                      )}
                    </td>
                    <td>{getRiskBadge('Medium')}</td>
                    <td>
                      <ButtonGroup size="sm">
                        <Button
                          style={{
                            borderColor: '#1594EA',
                            color: '#1594EA',
                          }} 
                          className="d-flex align-items-center gap-1 edit-btn"
                          variant="outline-primary"
                          onClick={() => showScanOptions(asset)}
                          disabled={scanningTargetId === asset._id || scanProgress.active}
                        >
                          {scanningTargetId === asset._id ? (
                            <>
                              <Spinner size="sm" animation="border" /> Scanning...
                            </>
                          ) : (
                            <>
                              <FaBug /> Scan
                            </>
                          )}
                        </Button>
                        <Button variant="outline-secondary" onClick={() => openEditModal(asset)}>
                          <FaEdit />
                        </Button>
                        <Button variant="outline-danger" onClick={() => handleDelete(asset._id)}>
                          <FaTrash />
                        </Button>
                      </ButtonGroup>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>

          {totalPages > 1 && (
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mt-3 gap-3">
              <div className="text-muted">
                Showing <strong>{indexOfFirstItem + 1}</strong> to{' '}
                <strong>{Math.min(indexOfLastItem, filteredAssets.length)}</strong> of{' '}
                <strong>{filteredAssets.length}</strong> assets
              </div>
              
              <Pagination className="mb-0">
                <Pagination.First 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  title="First Page"
                />
                
                <Pagination.Prev 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  title="Previous Page"
                />
                
                {getPageNumbers().map((page, index) => {
                  if (page === '...') {
                    return (
                      <Pagination.Ellipsis 
                        key={`ellipsis-${index}`} 
                        disabled 
                      />
                    );
                  }
                  
                  return (
                    <Pagination.Item
                      key={page}
                      active={page === currentPage}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Pagination.Item>
                  );
                })}
                
                <Pagination.Next
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  title="Next Page"
                />
                
                <Pagination.Last
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="Last Page"
                />
              </Pagination>
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header
          closeButton
          style={{ backgroundColor: '#1594EA', color: '#fff' }}
        >
          <Modal.Title>{isEditing ? 'Edit Server Asset' : 'Add Server Asset'}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#F0F9FF' }}>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control name="name" value={form.name} onChange={handleChange} required />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>IP Address</Form.Label>
                  <Form.Control
                    name="ip"
                    type="text"
                    value={form.ip}
                    onChange={handleChange}
                    pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
                    title="Enter a valid IPv4 address"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Type</Form.Label>
                  <Form.Select name="type" value={form.type} onChange={handleChange}>
                    {assetTypes.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Server Type</Form.Label>
                  <Form.Select name="serverType" value={form.serverType} onChange={handleChange}>
                    {serverTypes.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Select name="status" value={form.status} onChange={handleChange}>
                    {serverStatuses.map(status => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Administrator</Form.Label>
                  <Form.Control name="owner" value={form.owner} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>State</Form.Label>
                  <Form.Select name="state" value={form.state} onChange={handleChange}>
                    {serverStates.map(state => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Exposure</Form.Label>
                  <Form.Select name="exposure" value={form.exposure} onChange={handleChange}>
                    {serverExposures.map(exposure => (
                      <option key={exposure} value={exposure}>
                        {exposure}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Active Protocols</Form.Label>
                  <Form.Control name="activeProtocols" value={form.activeProtocols} onChange={handleChange} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Manufacturer</Form.Label>
                  <Form.Control name="manufacturer" value={form.manufacturer} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Model</Form.Label>
                  <Form.Control name="model" value={form.model} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Database Type & Version</Form.Label>
                  {form && (
                  <Form.Control
                    type="text"
                    list="dbVersionOptions"
                    name="dbType"
                    value={form.dbType || ''}
                    onChange={handleChange}
                    placeholder="Select or type Database Type & Version"
                  />)}
                  <datalist id="dbVersionOptions">
                    {dbOptions.map(dbType => (<option key={dbType} value={dbType}>{dbType}</option>))}
                  </datalist>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>WebServer Type & Version</Form.Label>
                  {form && (
                  <Form.Control
                    type="text"
                    list="wsVersionOptions"
                    name="wsType"
                    value={form.wsType || ''}
                    onChange={handleChange}
                    placeholder="Select or type WebServer Type & Version"
                  />)}
                  <datalist id="wsVersionOptions">
                    {webServerOptions.map(wsType => (<option key={wsType} value={wsType}>{wsType}</option>))}
                  </datalist>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>OS & Version</Form.Label>
                  {form && (<Form.Control
                    type="text"
                    list="osVersionOptions"
                    name="os"
                    value={form.os}
                    onChange={handleChange}
                    placeholder="Select or type OS & Version"
                  />)}
                  <datalist id="osVersionOptions">
                    {osOptions.map(os => (<option key={os} value={os}>{os}</option>))}
                  </datalist>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>CPU Capacity</Form.Label>
                  <Form.Control name="cpuCapacity" value={form.cpuCapacity} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Memory</Form.Label>
                  <Form.Control name="memory" value={form.memory} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Disk Space</Form.Label>
                  <Form.Control name="diskSpace" value={form.diskSpace} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Host Department</Form.Label>
                  <Form.Control name="hostDepartment" value={form.hostDepartment} onChange={handleChange} />
                </Form.Group>
              </Col>
            </Row>
            <div className="text-end">
              <Button
                variant="secondary"
                onClick={() => setShowModal(false)}
                className="me-2"
              >
                Cancel
              </Button>
              <Button
                style={{ backgroundColor: '#1594EA', border: 'none' }}
                type="submit"
              >
                {isEditing ? 'Update' : 'Add'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Servers;