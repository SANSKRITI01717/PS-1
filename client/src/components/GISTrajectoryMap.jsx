import React, { useState, useEffect, useRef } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  Polyline, 
  CircleMarker, 
  useMap 
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Search, 
  Navigation, 
  Clock, 
  Gauge, 
  ShieldAlert, 
  Layers, 
  Eye, 
  Play, 
  RotateCcw, 
  Crosshair, 
  Maximize2,
  Calendar,
  Compass,
  ArrowRight,
  MapPin
} from 'lucide-react';

// Fix Leaflet marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Camera Marker Icon Generator
const createCameraIcon = (status, isSelected) => {
  const color = status === 'ACTIVE' ? '#10b981' : status === 'MAINTENANCE' ? '#f59e0b' : '#ef4444';
  const border = isSelected ? '#38bdf8' : 'rgba(255,255,255,0.4)';
  const shadow = isSelected ? '0 0 15px #38bdf8' : '0 2px 8px rgba(0,0,0,0.6)';

  return L.divIcon({
    className: 'custom-camera-icon',
    html: `
      <div style="
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background-color: #0f172a;
        border: 2px solid ${border};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${shadow};
      ">
        <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${color};"></div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14]
  });
};

// Custom Waypoint Marker Icon Generator
const createWaypointIcon = (stepIndex, isCurrent) => {
  return L.divIcon({
    className: 'custom-waypoint-icon',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${isCurrent ? '#06b6d4' : '#1e293b'};
        color: ${isCurrent ? '#000000' : '#38bdf8'};
        border: 2px solid ${isCurrent ? '#ffffff' : '#38bdf8'};
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        font-weight: 800;
        font-size: 13px;
        box-shadow: 0 0 ${isCurrent ? '16px #06b6d4' : '8px rgba(56,189,248,0.5)'};
      ">
        ${stepIndex}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16]
  });
};

// Map Viewport Auto-Fitter
function MapAutoFit({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [bounds, map]);
  return null;
}

export default function GISTrajectoryMap({ initialPlate = 'MP04AB1234' }) {
  const [searchPlate, setSearchPlate] = useState(initialPlate);
  const [cameras, setCameras] = useState([]);
  const [trajectoryData, setTrajectoryData] = useState(null);
  const [vehicleHistory, setVehicleHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedHop, setSelectedHop] = useState(null);

  // Layer Visibility Controls
  const [showCameras, setShowCameras] = useState(true);
  const [showTrajectoryLine, setShowTrajectoryLine] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showTrafficZones, setShowTrafficZones] = useState(true);

  // Playback Animation State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(null);
  const animationTimerRef = useRef(null);

  // Fetch all camera terminals
  const loadCameras = async () => {
    try {
      const res = await fetch('/api/cameras');
      const data = await res.json();
      if (data.success) {
        setCameras(data.data);
      }
    } catch (e) {
      console.error('Failed to load cameras:', e);
    }
  };

  // Search Trajectory & History for a license plate
  const searchVehicleTrajectory = async (plateToSearch) => {
    const targetPlate = (plateToSearch || searchPlate).trim().toUpperCase();
    if (!targetPlate) return;

    setLoading(true);
    try {
      // 1. Fetch Trajectory
      const trajRes = await fetch(`/api/vehicles/${targetPlate}/trajectory`);
      const trajData = await trajRes.json();
      setTrajectoryData(trajData);

      // 2. Fetch Vehicle Profile & History
      const histRes = await fetch(`/api/vehicles/${targetPlate}/history`);
      const histData = await histRes.json();
      if (histData.success) {
        setVehicleHistory(histData.data);
      }

      setPlaybackIndex(null);
      setIsPlaying(false);
      if (trajData.trajectory && trajData.trajectory.length > 0) {
        setSelectedHop(trajData.trajectory[0]);
      } else {
        setSelectedHop(null);
      }
    } catch (err) {
      console.error('Error fetching trajectory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
    searchVehicleTrajectory(initialPlate);
  }, []);

  // Route Playback Animation
  useEffect(() => {
    if (isPlaying && trajectoryData?.trajectory?.length > 0) {
      animationTimerRef.current = setInterval(() => {
        setPlaybackIndex(prev => {
          const next = prev === null ? 0 : prev + 1;
          if (next >= trajectoryData.trajectory.length) {
            setIsPlaying(false);
            return null;
          }
          setSelectedHop(trajectoryData.trajectory[next]);
          return next;
        });
      }, 1800);
    } else {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    }
    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    };
  }, [isPlaying, trajectoryData]);

  // Coordinates array for Polyline: [[lat, lng], [lat, lng], ...]
  const polylineCoords = trajectoryData?.trajectory?.map(h => [h.latitude, h.longitude]) || [];

  // Map fit bounds
  const mapBounds = polylineCoords.length > 1 
    ? polylineCoords 
    : cameras.map(c => [c.coordinates.lat, c.coordinates.lng]);

  const defaultCenter = [28.4735, 77.075];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Search & Filter Bar */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Search Input Box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '540px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '4px 12px',
            flex: 1
          }}>
            <Search size={18} color="var(--accent-cyan)" />
            <input
              type="text"
              placeholder="Enter Vehicle Plate (e.g. MP04AB1234, DL01CA1234)..."
              value={searchPlate}
              onChange={e => setSearchPlate(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchVehicleTrajectory(searchPlate)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                padding: '8px 10px',
                fontSize: '14px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                width: '100%',
                outline: 'none',
                textTransform: 'uppercase'
              }}
            />
          </div>

          <button
            onClick={() => searchVehicleTrajectory(searchPlate)}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--accent-blue)',
              color: '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 2px 10px rgba(59, 130, 246, 0.3)'
            }}
          >
            <Navigation size={15} />
            {loading ? 'Reconstructing...' : 'Track Route'}
          </button>
        </div>

        {/* Quick Demo Plate Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>DEMO ROUTES:</span>
          {['MP04AB1234', 'DL01CA1234', 'DL01AB9999'].map(plate => (
            <button
              key={plate}
              onClick={() => {
                setSearchPlate(plate);
                searchVehicleTrajectory(plate);
              }}
              style={{
                backgroundColor: searchPlate === plate ? 'var(--bg-card-hover)' : 'var(--bg-primary)',
                color: searchPlate === plate ? 'var(--accent-cyan)' : 'var(--text-muted)',
                border: `1px solid ${searchPlate === plate ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {plate}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Map & Trajectory Telemetry Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>
        {/* Left Column: Full Leaflet Map Viewport */}
        <div style={{
          position: 'relative',
          height: '680px',
          backgroundColor: '#0a0f1d',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)'
        }}>
          {/* Map Layer Controls Bar */}
          <div style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '11px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input type="checkbox" checked={showCameras} onChange={e => setShowCameras(e.target.checked)} />
              Terminals
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input type="checkbox" checked={showTrajectoryLine} onChange={e => setShowTrajectoryLine(e.target.checked)} />
              Trajectory Polyline
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input type="checkbox" checked={showWaypoints} onChange={e => setShowWaypoints(e.target.checked)} />
              Hops (1-4)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input type="checkbox" checked={showTrafficZones} onChange={e => setShowTrafficZones(e.target.checked)} />
              Congestion Density
            </label>
          </div>

          {/* Route Playback Toolbar */}
          {trajectoryData?.trajectory?.length > 1 && (
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--accent-cyan)',
              borderRadius: '30px',
              padding: '6px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)'
            }}>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isPlaying ? '#ef4444' : 'var(--accent-cyan)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '12px'
                }}
              >
                {isPlaying ? <RotateCcw size={16} /> : <Play size={16} />}
                {isPlaying ? 'Pause Journey' : 'Animate Trajectory'}
              </button>
              <div style={{ height: '14px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {playbackIndex !== null 
                  ? `Simulating Hop ${playbackIndex + 1} of ${trajectoryData.trajectory.length}`
                  : `${trajectoryData.trajectory.length} Camera Sequence Ready`}
              </span>
            </div>
          )}

          {/* Leaflet Map Container */}
          <MapContainer
            center={defaultCenter}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            {/* Dark Matter GIS Tiles */}
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            <MapAutoFit bounds={mapBounds} />

            {/* Simulated Congestion Zones Overlay */}
            {showTrafficZones && (
              <>
                <CircleMarker
                  center={[28.4735, 77.0812]}
                  radius={45}
                  pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 1, dashArray: '4, 4' }}
                />
                <CircleMarker
                  center={[28.4905, 77.0898]}
                  radius={35}
                  pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.12, weight: 1, dashArray: '4, 4' }}
                />
              </>
            )}

            {/* Glowing Trajectory Polyline */}
            {showTrajectoryLine && polylineCoords.length > 1 && (
              <>
                {/* Glow underlay */}
                <Polyline
                  positions={polylineCoords}
                  pathOptions={{ color: '#06b6d4', weight: 8, opacity: 0.25 }}
                />
                {/* Core trajectory line */}
                <Polyline
                  positions={polylineCoords}
                  pathOptions={{ color: '#38bdf8', weight: 4, opacity: 0.95 }}
                />
              </>
            )}

            {/* Camera Network Markers */}
            {showCameras && cameras.map(cam => (
              <Marker
                key={cam.cameraId}
                position={[cam.coordinates.lat, cam.coordinates.lng]}
                icon={createCameraIcon(cam.status, selectedHop?.cameraId === cam.cameraId)}
              >
                <Popup>
                  <div style={{ padding: '4px', minWidth: '180px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>SURVEILLANCE NODE</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>{cam.name}</div>
                    <div style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'monospace' }}>ID: {cam.cameraId}</div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>{cam.location}</div>
                    <div style={{ fontSize: '10px', color: '#10b981', marginTop: '6px' }}>Status: {cam.status} ({cam.detectionCount || 0} hits)</div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Trajectory Waypoints Markers */}
            {showWaypoints && trajectoryData?.trajectory?.map((hop, idx) => {
              const isSelected = selectedHop?.stepIndex === hop.stepIndex;
              return (
                <Marker
                  key={`waypoint-${idx}`}
                  position={[hop.latitude, hop.longitude]}
                  icon={createWaypointIcon(hop.stepIndex, isSelected)}
                  eventHandlers={{
                    click: () => setSelectedHop(hop)
                  }}
                >
                  <Popup>
                    <div style={{ padding: '6px', minWidth: '220px' }}>
                      <div style={{ fontSize: '11px', color: '#06b6d4', fontWeight: 700 }}>
                        HOP #{hop.stepIndex} IN TRAJECTORY
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                        {hop.cameraName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0' }}>
                        {hop.location}
                      </div>
                      <div style={{ borderTop: '1px solid #334155', paddingTop: '6px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div>Timestamp: <strong style={{ color: '#f8fafc' }}>{new Date(hop.timestamp).toLocaleTimeString()}</strong></div>
                        <div>Sightings at Node: <strong>{hop.sightingCount}</strong></div>
                        {hop.dwellTimeSeconds > 0 && <div>Dwell Time: <strong>{hop.dwellTimeSeconds}s</strong></div>}
                        {hop.transitDistanceMeters > 0 && (
                          <div>Transit from Prev: <strong style={{ color: '#34d399' }}>{hop.transitDistanceMeters}m @ {hop.calculatedSpeedKmh} km/h</strong></div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Right Column: Vehicle Profile & Detection Sequence Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '680px', overflowY: 'auto' }}>
          {/* Vehicle Profile Card */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>IDENTIFIED TARGET</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                  {trajectoryData?.plateNumber || searchPlate}
                </div>
              </div>

              {vehicleHistory?.isBlacklisted && (
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  <ShieldAlert size={14} /> BLACKLIST
                </span>
              )}
            </div>

            {/* Route Summary Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid var(--border-subtle)'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ROUTE DISTANCE</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {trajectoryData?.totalDistanceKm || 0} km
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AVG SPEED</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  {trajectoryData?.averageSpeedKmh || 0} km/h
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>UNIQUE CAMERAS</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {trajectoryData?.uniqueCameras || 0} Terminals
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>TOTAL SIGHTINGS</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                  {trajectoryData?.totalSightings || 0} Frames
                </div>
              </div>
            </div>
          </div>

          {/* Chronological Sequence Timeline */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '18px',
            flex: 1
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Compass size={16} color="var(--accent-cyan)" />
              CHRONOLOGICAL CAMERA SEQUENCE
            </div>

            {(!trajectoryData?.trajectory || trajectoryData.trajectory.length === 0) ? (
              <div style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center', padding: '30px 0' }}>
                No multi-camera sightings found for this plate.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
                {trajectoryData.trajectory.map((hop, idx) => {
                  const isSelected = selectedHop?.stepIndex === hop.stepIndex;
                  return (
                    <div
                      key={hop.stepIndex}
                      onClick={() => setSelectedHop(hop)}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        backgroundColor: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                        border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                        borderRadius: '8px',
                        padding: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Step Number Badge */}
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.06)',
                        color: isSelected ? '#000000' : 'var(--accent-blue)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        flexShrink: 0
                      }}>
                        {hop.stepIndex}
                      </div>

                      {/* Hop Details */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                            {hop.cameraName}
                          </span>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                            {new Date(hop.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {hop.location}
                        </div>

                        {/* Hop Transit Metrics */}
                        {idx > 0 && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '6px',
                            fontSize: '10px',
                            color: 'var(--text-faint)'
                          }}>
                            <span>Transit: <strong style={{ color: 'var(--text-main)' }}>{hop.transitDistanceMeters}m</strong></span>
                            <span>•</span>
                            <span>Speed: <strong style={{ color: 'var(--accent-emerald)' }}>{hop.calculatedSpeedKmh} km/h</strong></span>
                            <span>•</span>
                            <span>Duration: {hop.transitTimeSeconds}s</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
