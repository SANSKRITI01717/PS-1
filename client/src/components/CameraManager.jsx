import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Video, 
  Plus, 
  Trash2, 
  Edit3, 
  Play, 
  Square, 
  Upload, 
  MapPin, 
  Radio, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Crosshair,
  Compass,
  RefreshCw
} from 'lucide-react';

export default function CameraManager({ socket, onCameraSelected }) {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [formData, setFormData] = useState({
    cameraId: '',
    name: '',
    location: '',
    lat: 28.4735,
    lng: 77.0812,
    direction: 'NORTHBOUND',
    status: 'ACTIVE',
    feedType: 'SIMULATED'
  });
  const [uploading, setUploading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [recentCameraDetections, setRecentCameraDetections] = useState([]);
  const [lastDetectionResult, setLastDetectionResult] = useState(null);

  // Fetch cameras
  const fetchCameras = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cameras');
      const data = await res.json();
      if (data.success) {
        setCameras(data.data);
        if (!selectedCamera && data.data.length > 0) {
          setSelectedCamera(data.data[0]);
        } else if (selectedCamera) {
          // Update selected camera reference
          const updated = data.data.find(c => c.cameraId === selectedCamera.cameraId);
          if (updated) setSelectedCamera(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load cameras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();

    if (!socket) return;

    // Socket.IO event listeners
    const handleDetection = (payload) => {
      // If detection belongs to current selected camera, update recent feed
      if (selectedCamera && payload.detection?.cameraId === selectedCamera.cameraId) {
        setRecentCameraDetections(prev => [payload.detection, ...prev.slice(0, 9)]);
        setLastDetectionResult(payload.detection);
      }
      // Update camera count in local list
      setCameras(prev => prev.map(c => {
        if (c.cameraId === payload.detection?.cameraId) {
          return {
            ...c,
            detectionCount: (c.detectionCount || 0) + 1,
            lastSeen: new Date().toISOString()
          };
        }
        return c;
      }));
    };

    const handleCameraCreated = (newCam) => {
      setCameras(prev => [newCam, ...prev]);
    };

    const handleCameraUpdated = (updCam) => {
      setCameras(prev => prev.map(c => c.cameraId === updCam.cameraId ? updCam : c));
      if (selectedCamera?.cameraId === updCam.cameraId) {
        setSelectedCamera(updCam);
      }
    };

    const handleCameraDeleted = ({ id }) => {
      setCameras(prev => prev.filter(c => c.cameraId !== id && c._id !== id));
      if (selectedCamera?.cameraId === id || selectedCamera?._id === id) {
        setSelectedCamera(null);
      }
    };

    const handleStreamStatus = ({ cameraId, streaming }) => {
      setCameras(prev => prev.map(c => c.cameraId === cameraId ? { ...c, isStreaming: streaming } : c));
      if (selectedCamera?.cameraId === cameraId) {
        setSelectedCamera(prev => ({ ...prev, isStreaming: streaming }));
      }
    };

    socket.on('detection:new', handleDetection);
    socket.on('camera:created', handleCameraCreated);
    socket.on('camera:updated', handleCameraUpdated);
    socket.on('camera:deleted', handleCameraDeleted);
    socket.on('camera:stream-status', handleStreamStatus);

    return () => {
      socket.off('detection:new', handleDetection);
      socket.off('camera:created', handleCameraCreated);
      socket.off('camera:updated', handleCameraUpdated);
      socket.off('camera:deleted', handleCameraDeleted);
      socket.off('camera:stream-status', handleStreamStatus);
    };
  }, [socket, selectedCamera?.cameraId]);

  // Load detections for selected camera
  useEffect(() => {
    if (!selectedCamera) return;
    fetch(`/api/detections?cameraId=${selectedCamera.cameraId}&limit=10`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setRecentCameraDetections(res.data);
          if (res.data.length > 0) {
            setLastDetectionResult(res.data[0]);
          }
        }
      })
      .catch(console.error);
  }, [selectedCamera?.cameraId]);

  // Toggle Stream
  const toggleStreaming = async (cam) => {
    if (!cam) return;
    const action = cam.isStreaming ? 'stop' : 'start';
    try {
      const res = await fetch(`/api/cameras/${cam.cameraId}/stream/${action}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCameras(prev => prev.map(c => c.cameraId === cam.cameraId ? { ...c, isStreaming: !cam.isStreaming } : c));
        if (selectedCamera?.cameraId === cam.cameraId) {
          setSelectedCamera(prev => ({ ...prev, isStreaming: !cam.isStreaming }));
        }
      }
    } catch (err) {
      console.error('Failed to toggle stream:', err);
    }
  };

  // Trigger On-Demand Vehicle Pass
  const triggerVehicleDetection = async (cam) => {
    if (!cam) return;
    setTriggering(true);
    try {
      const res = await fetch(`/api/cameras/${cam.cameraId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleIndex: Math.floor(Math.random() * 3) })
      });
      const data = await res.json();
      if (data.success && data.records && data.records.length > 0) {
        setLastDetectionResult(data.records[0]);
      }
    } catch (err) {
      console.error('Trigger detection failed:', err);
    } finally {
      setTriggering(false);
    }
  };

  // Upload image to selected camera
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedCamera) return;
    const body = new FormData();
    body.append('media', file);
    setUploading(true);
    try {
      const res = await fetch(`/api/cameras/${selectedCamera.cameraId}/upload`, {
        method: 'POST',
        body
      });
      const data = await res.json();
      if (data.success && data.records && data.records.length > 0) {
        setLastDetectionResult(data.records[0]);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setModalMode('CREATE');
    setFormData({
      cameraId: `CAM-IND-0${cameras.length + 1}`,
      name: '',
      location: '',
      lat: 28.47 + Math.random() * 0.05,
      lng: 77.07 + Math.random() * 0.05,
      direction: 'NORTHBOUND',
      status: 'ACTIVE',
      feedType: 'SIMULATED'
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (cam) => {
    setModalMode('EDIT');
    setFormData({
      cameraId: cam.cameraId,
      name: cam.name,
      location: cam.location,
      lat: cam.coordinates?.lat || 28.4735,
      lng: cam.coordinates?.lng || 77.0812,
      direction: cam.direction || 'NORTHBOUND',
      status: cam.status || 'ACTIVE',
      feedType: cam.feedType || 'SIMULATED'
    });
    setIsModalOpen(true);
  };

  // Save Modal
  const handleSaveCamera = async (e) => {
    e.preventDefault();
    const payload = {
      cameraId: formData.cameraId.trim(),
      name: formData.name.trim(),
      location: formData.location.trim(),
      coordinates: { lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) },
      direction: formData.direction,
      status: formData.status,
      feedType: formData.feedType
    };

    try {
      if (modalMode === 'CREATE') {
        const res = await fetch('/api/cameras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) alert(data.message || 'Failed to create camera');
        else {
          setIsModalOpen(false);
          fetchCameras();
        }
      } else {
        const res = await fetch(`/api/cameras/${formData.cameraId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) alert(data.message || 'Failed to update camera');
        else {
          setIsModalOpen(false);
          fetchCameras();
        }
      }
    } catch (err) {
      console.error('Error saving camera:', err);
    }
  };

  // Delete camera
  const handleDeleteCamera = async (camId) => {
    if (!window.confirm(`Are you sure you want to decommission camera '${camId}'?`)) return;
    try {
      const res = await fetch(`/api/cameras/${camId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCameras();
      }
    } catch (err) {
      console.error('Failed to delete camera:', err);
    }
  };

  const filteredCameras = cameras.filter(c => filterStatus === 'ALL' || c.status === filterStatus);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Action & Metric Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '16px 20px',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '8px',
            backgroundColor: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-blue)',
            border: '1px solid #bfdbfe'
          }}>
            <Camera size={22} />
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)' }}>
              City Camera Infrastructure Management
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Configure surveillance terminals, GPS node mappings, and real-time ANPR inference feeds
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Status Filter */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '6px', padding: '3px', border: '1px solid var(--border-subtle)' }}>
            {['ALL', 'ACTIVE', 'MAINTENANCE', 'INACTIVE'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  background: filterStatus === status ? 'var(--accent-blue)' : 'transparent',
                  color: filterStatus === status ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {status}
              </button>
            ))}
          </div>

          <button
            onClick={openCreateModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--accent-blue)',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
              transition: 'background-color 0.15s ease'
            }}
          >
            <Plus size={16} /> Add Camera
          </button>
        </div>
      </div>

      {/* Main Split Layout: Cameras List & Live Monitoring Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', gap: '20px' }}>
        {/* Left Column: Camera List Cards */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: '740px',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
              SURVEILLANCE TERMINALS ({filteredCameras.length})
            </span>
            <button 
              onClick={fetchCameras} 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}
            >
              <RefreshCw size={13} /> Sync
            </button>
          </div>

          {filteredCameras.map(cam => {
            const isSelected = selectedCamera?.cameraId === cam.cameraId;
            const statusColor = cam.isStreaming ? '#0284c7' : (cam.status === 'ACTIVE' ? '#16a34a' : (cam.status === 'MAINTENANCE' ? '#d97706' : '#dc2626'));
            const statusBg = cam.isStreaming ? '#e0f2fe' : (cam.status === 'ACTIVE' ? '#dcfce7' : (cam.status === 'MAINTENANCE' ? '#fef3c7' : '#fee2e2'));

            return (
              <div
                key={cam.cameraId}
                onClick={() => {
                  setSelectedCamera(cam);
                  if (onCameraSelected) onCameraSelected(cam);
                }}
                style={{
                  backgroundColor: isSelected ? '#f8faff' : '#ffffff',
                  border: `1px solid ${isSelected ? '#93c5fd' : 'var(--border-subtle)'}`,
                  borderLeft: `4px solid ${isSelected ? 'var(--accent-blue)' : '#cbd5e1'}`,
                  borderRadius: '8px',
                  padding: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.08)' : '0 1px 2px rgba(0, 0, 0, 0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: statusColor
                    }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--accent-blue)' }}>
                      {cam.cameraId}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: statusBg,
                      color: statusColor,
                      border: `1px solid ${statusColor}30`
                    }}>
                      {cam.feedType}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openEditModal(cam)}
                      title="Edit Camera Details"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteCamera(cam.cameraId)}
                      title="Decommission Camera"
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '2px' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  {cam.name}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  <MapPin size={12} color="var(--accent-blue)" />
                  <span>{cam.location}</span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '11px',
                  color: 'var(--text-muted)'
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    GPS: {cam.coordinates?.lat?.toFixed(4)}, {cam.coordinates?.lng?.toFixed(4)}
                  </span>
                  <span style={{ color: '#15803d', fontWeight: 700 }}>
                    {cam.detectionCount || 0} Detections
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Camera Details & Live Monitoring Station */}
        {selectedCamera ? (
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {/* Monitor Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Radio size={16} color={selectedCamera.isStreaming ? '#0284c7' : 'var(--text-muted)'} />
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                    TERMINAL MONITOR: {selectedCamera.cameraId}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedCamera.name} ({selectedCamera.location})
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => toggleStreaming(selectedCamera)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: selectedCamera.isStreaming ? '#fee2e2' : '#eff6ff',
                    color: selectedCamera.isStreaming ? '#b91c1c' : 'var(--accent-blue)',
                    border: `1px solid ${selectedCamera.isStreaming ? '#fca5a5' : '#bfdbfe'}`,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {selectedCamera.isStreaming ? <><Square size={13} /> Stop Stream</> : <><Play size={13} /> Live Stream</>}
                </button>

                <button
                  onClick={() => triggerVehicleDetection(selectedCamera)}
                  disabled={triggering}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: triggering ? 'wait' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Crosshair size={14} />
                  {triggering ? 'Processing Frame...' : 'Simulate Vehicle Pass'}
                </button>
              </div>
            </div>

            {/* Live Viewport Screen (Crisp Surveillance Monitor) */}
            <div style={{
              height: '320px',
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              border: '1px solid #334155',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.6)'
            }}>
              {/* Surveillance HUD Overlay */}
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                zIndex: 10,
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                color: '#f8fafc',
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: selectedCamera.isStreaming ? '#ef4444' : '#10b981',
                  boxShadow: selectedCamera.isStreaming ? '0 0 6px #ef4444' : '0 0 4px #10b981'
                }} />
                <span style={{ fontWeight: 700 }}>{selectedCamera.isStreaming ? 'LIVE INGESTION' : 'FEED STANDBY'}</span>
                <span style={{ color: '#64748b' }}>|</span>
                <span>{selectedCamera.direction}</span>
              </div>

              <div style={{
                position: 'absolute',
                top: '12px',
                right: '14px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#38bdf8',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                zIndex: 10
              }}>
                GPS: {selectedCamera.coordinates?.lat?.toFixed(4)}, {selectedCamera.coordinates?.lng?.toFixed(4)}
              </div>

              {/* Viewport Canvas or Reticle */}
              <div style={{
                width: '90%',
                height: '80%',
                border: '1px dashed rgba(56, 189, 248, 0.3)',
                borderRadius: '6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {lastDetectionResult ? (
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '2px solid #2563eb',
                    padding: '16px 26px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
                  }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '4px' }}>
                      VEHICLE DETECTED
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                      {lastDetectionResult.plateNumber}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginTop: '8px', fontSize: '11px', color: '#475569' }}>
                      <span>Confidence: <strong style={{ color: '#15803d' }}>{(lastDetectionResult.confidence * 100).toFixed(1)}%</strong></span>
                      <span>Direction: <strong>{lastDetectionResult.direction}</strong></span>
                      <span>Vehicle: <strong>{lastDetectionResult.vehicleType || 'SEDAN'}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                    <Video size={40} style={{ opacity: 0.4, marginBottom: '8px' }} />
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>Feed Standby</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Click 'Live Stream' or 'Simulate Vehicle Pass' to activate monitoring</div>
                  </div>
                )}
              </div>

              {/* Bottom HUD Bar */}
              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '14px',
                right: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#94a3b8'
              }}>
                <span>FPS: 25.0 | RES: 1920x1080</span>
                <span>OPTICAL FEED: ACTIVE</span>
              </div>
            </div>

            {/* Media Upload Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Upload size={18} color="var(--accent-blue)" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Direct Frame Ingestion</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Upload custom video or image for terminal recognition</div>
                </div>
              </div>

              <label style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                color: 'var(--text-main)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: uploading ? 'wait' : 'pointer',
                display: 'inline-block',
                transition: 'border-color 0.15s ease'
              }}>
                {uploading ? 'Processing File...' : 'Select File'}
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </label>
            </div>

            {/* Camera Detection Event Timeline */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                REAL-TIME SIGHTING TIMELINE FOR {selectedCamera.cameraId}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {recentCameraDetections.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    No detections recorded yet for this camera.
                  </div>
                ) : (
                  recentCameraDetections.map((det, i) => (
                    <div
                      key={det._id || i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-blue)' }}>
                          {det.plateNumber}
                        </span>
                        <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>
                          {(det.confidence * 100).toFixed(1)}% conf
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                        {new Date(det.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            padding: '40px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            Select a camera terminal from the list to view its live feed and monitoring controls.
          </div>
        )}
      </div>

      {/* Modal: Add or Edit Camera */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            width: '460px',
            maxWidth: '90%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)' }}>
              {modalMode === 'CREATE' ? 'Register New Camera Terminal' : `Edit Camera: ${formData.cameraId}`}
            </div>

            <form onSubmit={handleSaveCamera} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Camera ID</label>
                <input
                  type="text"
                  required
                  disabled={modalMode === 'EDIT'}
                  value={formData.cameraId}
                  onChange={e => setFormData({ ...formData, cameraId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: modalMode === 'EDIT' ? '#f1f5f9' : '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: 'var(--text-main)',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Camera Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ring Road North Flyover"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: 'var(--text-main)',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Location / Sector Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NH-48 Km 18 Outer Bypass"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: 'var(--text-main)',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.lat}
                    onChange={e => setFormData({ ...formData, lat: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: 'var(--text-main)',
                      fontSize: '13px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.lng}
                    onChange={e => setFormData({ ...formData, lng: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: 'var(--text-main)',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Traffic Direction</label>
                  <select
                    value={formData.direction}
                    onChange={e => setFormData({ ...formData, direction: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: 'var(--text-main)',
                      fontSize: '13px'
                    }}
                  >
                    <option value="NORTHBOUND">NORTHBOUND</option>
                    <option value="SOUTHBOUND">SOUTHBOUND</option>
                    <option value="EASTBOUND">EASTBOUND</option>
                    <option value="WESTBOUND">WESTBOUND</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: 'var(--text-main)',
                      fontSize: '13px'
                    }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: 'var(--text-muted)',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: 'var(--accent-blue)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  {modalMode === 'CREATE' ? 'Register Terminal' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
