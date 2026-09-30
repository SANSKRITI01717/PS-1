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
  const color = status === 'ACTIVE' ? '#10b981' : status === 'MAINTENANCE' ? '#f59e0b' : '#ef4444';
  const ring = hasRecentHit ? '0 0 20px #06b6d4, 0 0 10px #06b6d4' : '0 2px 8px rgba(0,0,0,0.6)';
  const border = hasRecentHit ? '#06b6d4' : 'rgba(255,255,255,0.4)';

  return L.divIcon({
    className: 'command-camera-icon',
    html: `
      <div style="
        width: ${hasRecentHit ? '32px' : '26px'};
        height: ${hasRecentHit ? '32px' : '26px'};
        border-radius: 50%;
        background-color: #0f172a;
        border: 2px solid ${border};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${ring};
        transition: all 0.3s ease;
      ">
        <div style="
          width: ${hasRecentHit ? '14px' : '10px'}; 
          height: ${hasRecentHit ? '14px' : '10px'}; 
          border-radius: 50%; 
          background-color: ${hasRecentHit ? '#06b6d4' : color};
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Top Real-Time Telemetry Bar (6 Compact Metric Indicators) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        {/* Metric 1: Active Cameras */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TERMINALS ACTIVE</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {summary ? `${summary.activeCameras} / ${summary.totalCameras}` : '--'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--accent-emerald)', marginTop: '2px' }}>
              {summary?.networkHealthPercentage || 100}% Network Health
            </div>
          </div>
          <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
            <Camera size={22} />
          </div>
        </div>

        {/* Metric 2: Detections Today */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>DETECTIONS TODAY</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {summary?.detectionsToday ?? '--'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Real-Time AI Stream
            </div>
          </div>
          <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(6, 182, 212, 0.12)', color: 'var(--accent-cyan)' }}>
            <Zap size={22} />
          </div>
        </div>

        {/* Metric 3: Unique Vehicles */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>UNIQUE VEHICLES</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {summary?.uniqueVehicles ?? '--'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--accent-blue)', marginTop: '2px' }}>
              Profiles Cataloged
            </div>
          </div>
          <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' }}>
            <Car size={22} />
          </div>
        </div>

        {/* Metric 4: Security Alerts */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE ALERTS</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: (summary?.activeAlerts || 0) > 0 ? '#f87171' : 'var(--text-main)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {summary?.activeAlerts ?? 0}
            </div>
            <div style={{ fontSize: '10px', color: (summary?.activeAlerts || 0) > 0 ? '#f87171' : 'var(--text-muted)', marginTop: '2px' }}>
              {(summary?.activeAlerts || 0) > 0 ? 'Requires Attention' : 'All Zones Clear'}
            </div>
          </div>
          <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>
            <ShieldAlert size={22} />
          </div>
        </div>

        {/* Metric 5: Average Speed */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>CITY AVG SPEED</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {summary ? `${summary.averageSpeedKmh} km/h` : '--'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Calculated Transit
            </div>
          </div>
          <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
            <Gauge size={22} />
          </div>
        </div>

        {/* Metric 6: City Traffic Rating & Simulation Trigger */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TRAFFIC CONDITION</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: '4px' }}>
              {summary?.trafficCondition || 'OPTIMAL FLOW'}
            </div>
          </div>
          <button
            onClick={triggerTrafficBurst}
            disabled={isSimulatingBurst}
            style={{
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: isSimulatingBurst ? 'wait' : 'pointer',
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Radio size={13} /> {isSimulatingBurst ? 'Triggering...' : 'Simulate Live Pass'}
          </button>
        </div>
      </div>

      {/* Main Operational Section: LARGE GIS MAP + Real-Time Telemetry Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: '18px', height: '660px' }}>
        
        {/* Left Panel: Live Sighting Detection Feed (Socket.IO Stream) */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-cyan)', boxShadow: '0 0 8px #06b6d4' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>LIVE ANPR FEED</span>
            </div>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
              {recentDetections.length} Recs
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentDetections.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '12px' }}>
                Waiting for incoming detections...
              </div>
            ) : (
              recentDetections.map((det, i) => (
                <div
                  key={det._id || i}
                  onClick={() => onNavigateToTrajectory && onNavigateToTrajectory(det.plateNumber)}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-cyan)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                      {det.plateNumber}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399'
                    }}>
                      {(det.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
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

        {/* Center Panel: LARGE GIS MAP Centerpiece */}
        <div style={{
          backgroundColor: '#070b14',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
        }}>
          {/* Top Banner on Map */}
          <div style={{
            position: 'absolute',
            top: '14px',
            left: '16px',
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span>CITY SURVEILLANCE GRID</span>
            <span style={{ color: 'var(--text-faint)' }}>|</span>
            <span style={{ color: 'var(--accent-cyan)' }}>REAL-TIME GIS NODE NETWORK</span>
          </div>

          <MapContainer
            center={defaultCenter}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>TERMINAL STATUS</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>{cam.name}</div>
                      <div style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'monospace' }}>{cam.cameraId}</div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '3px' }}>{cam.location}</div>
                      <div style={{ fontSize: '10px', color: '#10b981', marginTop: '6px' }}>
                        Detections: {cam.detectionCount || 0}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Right Panel: High-Priority Alerts & Network Status */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} color="#f87171" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>CRITICAL ALERTS</span>
            </div>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171'
            }}>
              {alerts.length} OPEN
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '12px' }}>
                No critical security alerts currently active.
              </div>
            ) : (
              alerts.map((al, idx) => (
                <div
                  key={al._id || idx}
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    padding: '10px 12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: '3px',
                      backgroundColor: '#ef4444',
                      color: '#ffffff'
                    }}>
                      {al.type}
                    </span>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
                      {new Date(al.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {al.plateNumber ? `Vehicle: ${al.plateNumber}` : 'System Alert'}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
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
