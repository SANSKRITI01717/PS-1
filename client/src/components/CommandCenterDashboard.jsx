import React, { useState, useEffect, useRef } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  CircleMarker, 
  useMap 
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Radio, 
  ShieldAlert, 
  Activity, 
  Camera, 
  Compass, 
  Gauge, 
  Car, 
  AlertTriangle, 
  CheckCircle2, 
  Flame, 
  Zap, 
  ArrowUpRight,
  RefreshCw,
  Eye,
  Sliders
} from 'lucide-react';

const createCameraIcon = (status, hasRecentHit) => {
  const color = status === 'ACTIVE' ? '#16a34a' : status === 'MAINTENANCE' ? '#d97706' : '#dc2626';
  const ring = hasRecentHit ? '0 0 0 6px rgba(37, 99, 235, 0.25)' : '0 1px 3px rgba(0,0,0,0.15)';
  const border = hasRecentHit ? '#2563eb' : '#ffffff';

  return L.divIcon({
    className: 'command-camera-icon',
    html: `
      <div style="
        width: ${hasRecentHit ? '30px' : '24px'};
        height: ${hasRecentHit ? '30px' : '24px'};
        border-radius: 50%;
        background-color: #ffffff;
        border: 2px solid ${border};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${ring};
        transition: all 0.2s ease;
      ">
        <div style="
          width: ${hasRecentHit ? '12px' : '9px'}; 
          height: ${hasRecentHit ? '12px' : '9px'}; 
          border-radius: 50%; 
          background-color: ${hasRecentHit ? '#2563eb' : color};
        "></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
};

export default function CommandCenterDashboard({ socket, onNavigateToTrajectory }) {
  const [summary, setSummary] = useState(null);
  const [recentDetections, setRecentDetections] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [recentHitCameraId, setRecentHitCameraId] = useState(null);
  const [isSimulatingBurst, setIsSimulatingBurst] = useState(false);

  // Fetch telemetry summary
  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/command-center/summary');
      const data = await res.json();
      if (data.success) {
        setSummary(data.stats);
        setRecentDetections(data.recentDetections);
        setAlerts(data.recentAlerts);
        setCameras(data.cameras);
        if (!selectedCamera && data.cameras.length > 0) {
          setSelectedCamera(data.cameras[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load command center summary:', err);
    }
  };

  useEffect(() => {
    fetchSummary();

    if (!socket) return;

    // Real-Time Socket.IO listeners
    const onNewDetection = (payload) => {
      const { detection, camera } = payload;

      // 1. Prepend detection to live stream
      setRecentDetections(prev => [detection, ...prev.slice(0, 24)]);

      // 2. Pulse camera on map
      if (detection.cameraId) {
        setRecentHitCameraId(detection.cameraId);
        setTimeout(() => setRecentHitCameraId(null), 3500);
      }

      // 3. Update top counters without full page reload
      setSummary(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          detectionsToday: prev.detectionsToday + 1
        };
      });

      // 4. Update camera count locally
      setCameras(prev => prev.map(c => {
        if (c.cameraId === detection.cameraId) {
          return {
            ...c,
            detectionCount: (c.detectionCount || 0) + 1,
            lastSeen: new Date().toISOString()
          };
        }
        return c;
      }));
    };

    const onNewAlert = (alert) => {
      setAlerts(prev => [alert, ...prev.slice(0, 14)]);
      setSummary(prev => {
        if (!prev) return prev;
        return { ...prev, activeAlerts: prev.activeAlerts + 1 };
      });
    };

    socket.on('detection:new', onNewDetection);
    socket.on('alert:new', onNewAlert);

    return () => {
      socket.off('detection:new', onNewDetection);
      socket.off('alert:new', onNewAlert);
    };
  }, [socket]);

  // Trigger automated vehicle burst
  const triggerTrafficBurst = async () => {
    setIsSimulatingBurst(true);
    try {
      const activeCams = cameras.filter(c => c.status === 'ACTIVE');
      if (activeCams.length === 0) return;
      
      const targetCam = activeCams[Math.floor(Math.random() * activeCams.length)];
      await fetch(`/api/cameras/${targetCam.cameraId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleIndex: Math.floor(Math.random() * 3) })
      });
    } catch (e) {
      console.error('Traffic burst failed:', e);
    } finally {
      setIsSimulatingBurst(false);
    }
  };

  const defaultCenter = [28.4735, 77.075];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Real-Time Telemetry Bar (6 Clean Compact Metric Cards) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '12px'
      }}>
        {/* Metric 1: Active Terminals */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>TERMINALS ACTIVE</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {summary ? `${summary.activeCameras} / ${summary.totalCameras}` : '--'}
            </div>
            <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>
              {summary?.networkHealthPercentage || 100}% Network Health
            </div>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#16a34a' }}>
            <Camera size={20} />
          </div>
        </div>

        {/* Metric 2: Detections Today */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>DETECTIONS TODAY</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#2563eb', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {summary?.detectionsToday ?? '--'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Real-Time AI Stream
            </div>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <Zap size={20} />
          </div>
        </div>

        {/* Metric 3: Unique Vehicles */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>UNIQUE VEHICLES</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {summary?.uniqueVehicles ?? '--'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Profiles Cataloged
            </div>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#475569' }}>
            <Car size={20} />
          </div>
        </div>

        {/* Metric 4: Security Alerts */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>ACTIVE ALERTS</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: (summary?.activeAlerts || 0) > 0 ? '#dc2626' : '#0f172a', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {summary?.activeAlerts ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: (summary?.activeAlerts || 0) > 0 ? '#dc2626' : '#64748b', marginTop: '2px', fontWeight: (summary?.activeAlerts || 0) > 0 ? 600 : 400 }}>
              {(summary?.activeAlerts || 0) > 0 ? 'Requires Attention' : 'All Zones Clear'}
            </div>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: (summary?.activeAlerts || 0) > 0 ? '#fef2f2' : '#f1f5f9', color: (summary?.activeAlerts || 0) > 0 ? '#dc2626' : '#64748b' }}>
            <ShieldAlert size={20} />
          </div>
        </div>

        {/* Metric 5: Average Speed */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>CITY AVG SPEED</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {summary ? `${summary.averageSpeedKmh} km/h` : '--'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Calculated Transit
            </div>
          </div>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#16a34a' }}>
            <Gauge size={20} />
          </div>
        </div>

        {/* Metric 6: City Traffic Rating & Simulation Trigger */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>TRAFFIC CONDITION</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
              {summary?.trafficCondition || 'OPTIMAL FLOW'}
            </div>
          </div>
          <button
            onClick={triggerTrafficBurst}
            disabled={isSimulatingBurst}
            style={{
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: isSimulatingBurst ? 'wait' : 'pointer',
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background 0.15s ease'
            }}
          >
            <Radio size={13} /> {isSimulatingBurst ? 'Triggering...' : 'Simulate Live Pass'}
          </button>
        </div>
      </div>

      {/* Main Operational Section: LARGE GIS MAP + Real-Time Telemetry Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: '16px', height: '660px' }}>
        
        {/* Left Panel: Live Sighting Detection Feed (Clean White Card) */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>LIVE ANPR FEED</span>
            </div>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
              {recentDetections.length} Recs
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentDetections.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                Waiting for incoming detections...
              </div>
            ) : (
              recentDetections.map((det, i) => (
                <div
                  key={det._id || i}
                  onClick={() => onNavigateToTrajectory && onNavigateToTrajectory(det.plateNumber)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                      {det.plateNumber}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: '#f0fdf4',
                      color: '#16a34a',
                      border: '1px solid #bbf7d0'
                    }}>
                      {(det.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                    <span>{det.cameraId}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {new Date(det.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center Panel: LARGE LIGHT GIS MAP Centerpiece */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Top Banner on Map */}
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '14px',
            zIndex: 1000,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
            color: '#0f172a'
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
            <span style={{ fontWeight: 600 }}>CITY SURVEILLANCE GRID</span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ color: '#2563eb', fontWeight: 600 }}>REAL-TIME GIS NODES</span>
          </div>

          <MapContainer
            center={defaultCenter}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />

            {cameras.map(cam => {
              const hasRecentHit = recentHitCameraId === cam.cameraId;
              return (
                <Marker
                  key={cam.cameraId}
                  position={[cam.coordinates.lat, cam.coordinates.lng]}
                  icon={createCameraIcon(cam.status, hasRecentHit)}
                  eventHandlers={{
                    click: () => setSelectedCamera(cam)
                  }}
                >
                  <Popup>
                    <div style={{ padding: '4px', minWidth: '180px' }}>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>TERMINAL STATUS</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{cam.name}</div>
                      <div style={{ fontSize: '11px', color: '#2563eb', fontFamily: 'var(--font-mono)' }}>{cam.cameraId}</div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>{cam.location}</div>
                      <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '6px', fontWeight: 600 }}>
                        Detections: {cam.detectionCount || 0}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Right Panel: High-Priority Alerts & Incidents */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} color="#dc2626" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>CRITICAL ALERTS</span>
            </div>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca'
            }}>
              {alerts.length} OPEN
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                No critical security alerts currently active.
              </div>
            ) : (
              alerts.map((al, idx) => (
                <div
                  key={al._id || idx}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #fecaca',
                    borderLeft: '4px solid #dc2626',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    boxShadow: '0 1px 2px rgba(220, 38, 38, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '3px',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca'
                    }}>
                      {al.type}
                    </span>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
                      {new Date(al.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>
                    {al.plateNumber ? `Vehicle: ${al.plateNumber}` : 'System Alert'}
                  </div>

                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px', lineHeight: 1.4 }}>
                    {al.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
