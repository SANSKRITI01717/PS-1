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
  const color = status === 'ACTIVE' ? '#16a34a' : status === 'MAINTENANCE' ? '#d97706' : '#dc2626';
  const border = isSelected ? '#2563eb' : '#ffffff';
  const shadow = isSelected ? '0 0 0 4px rgba(37, 99, 235, 0.25)' : '0 1px 3px rgba(0,0,0,0.15)';

  return L.divIcon({
    className: 'custom-camera-icon',
    html: `
      <div style="
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background-color: #ffffff;
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
        background: ${isCurrent ? '#2563eb' : '#ffffff'};
        color: ${isCurrent ? '#ffffff' : '#2563eb'};
        border: 2px solid #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        font-weight: 700;
        font-size: 13px;
        box-shadow: 0 2px 6px ${isCurrent ? 'rgba(37, 99, 235, 0.4)' : 'rgba(0,0,0,0.12)'};
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
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Search Input Box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '520px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '2px 10px',
            flex: 1
          }}>
            <Search size={16} color="#2563eb" />
            <input
              type="text"
              placeholder="Search Vehicle Plate (e.g. MP04AB1234, DL01CA1234)..."
              value={searchPlate}
              onChange={e => setSearchPlate(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchVehicleTrajectory(searchPlate)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#0f172a',
                padding: '7px 8px',
                fontSize: '13px',
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
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Navigation size={14} />
            {loading ? 'Reconstructing...' : 'Track Route'}
          </button>
        </div>

        {/* Quick Demo Plate Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>DEMO ROUTES:</span>
          {['MP04AB1234', 'DL01CA1234', 'DL01AB9999'].map(plate => (
            <button
              key={plate}
              onClick={() => {
                setSearchPlate(plate);
                searchVehicleTrajectory(plate);
              }}
              style={{
                backgroundColor: searchPlate === plate ? '#eff6ff' : '#f8fafc',
                color: searchPlate === plate ? '#2563eb' : '#475569',
                border: `1px solid ${searchPlate === plate ? '#bfdbfe' : '#e2e8f0'}`,
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px' }}>
        {/* Left Column: Full Leaflet Map Viewport */}
        <div style={{
          position: 'relative',
          height: '680px',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Map Layer Controls Bar */}
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 1000,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '11px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            color: '#0f172a'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showCameras} onChange={e => setShowCameras(e.target.checked)} />
              Terminals
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showTrajectoryLine} onChange={e => setShowTrajectoryLine(e.target.checked)} />
              Route Line
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showWaypoints} onChange={e => setShowWaypoints(e.target.checked)} />
              Hops (1-4)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showTrafficZones} onChange={e => setShowTrafficZones(e.target.checked)} />
              Congestion Density
            </label>
          </div>

          {/* Route Playback Toolbar */}
          {trajectoryData?.trajectory?.length > 1 && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #cbd5e1',
              borderRadius: '24px',
              padding: '6px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
            }}>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isPlaying ? '#dc2626' : '#2563eb',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  fontSize: '12px'
                }}
              >
                {isPlaying ? <RotateCcw size={15} /> : <Play size={15} />}
                {isPlaying ? 'Pause Journey' : 'Animate Trajectory'}
              </button>
              <div style={{ height: '14px', width: '1px', backgroundColor: '#e2e8f0' }} />
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                {playbackIndex !== null 
                  ? `Simulating Hop ${playbackIndex + 1} of ${trajectoryData.trajectory.length}`
                  : `${trajectoryData.trajectory.length} Camera Sequence Ready`}
              </span>
            </div>
          )}

          {/* Leaflet Map Container with Light Tiles */}
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

            <MapAutoFit bounds={mapBounds} />

            {/* Congestion Zones Overlay */}
            {showTrafficZones && (
              <>
                <CircleMarker
                  center={[28.4735, 77.0812]}
                  radius={40}
                  pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.12, weight: 1.5, dashArray: '4, 4' }}
                />
                <CircleMarker
                  center={[28.4905, 77.0898]}
                  radius={32}
                  pathOptions={{ color: '#d97706', fillColor: '#d97706', fillOpacity: 0.10, weight: 1.5, dashArray: '4, 4' }}
                />
              </>
            )}

            {/* Clean Trajectory Polyline */}
            {showTrajectoryLine && polylineCoords.length > 1 && (
              <Polyline
                positions={polylineCoords}
                pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.9 }}
              />
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
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>SURVEILLANCE NODE</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{cam.name}</div>
                    <div style={{ fontSize: '11px', color: '#2563eb', fontFamily: 'monospace' }}>ID: {cam.cameraId}</div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>{cam.location}</div>
                    <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '6px', fontWeight: 600 }}>Status: {cam.status} ({cam.detectionCount || 0} hits)</div>
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
                      <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>
                        HOP #{hop.stepIndex} IN TRAJECTORY
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                        {hop.cameraName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', margin: '4px 0' }}>
                        {hop.location}
                      </div>
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div>Timestamp: <strong style={{ color: '#0f172a' }}>{new Date(hop.timestamp).toLocaleTimeString()}</strong></div>
                        <div>Sightings at Node: <strong>{hop.sightingCount}</strong></div>
                        {hop.dwellTimeSeconds > 0 && <div>Dwell Time: <strong>{hop.dwellTimeSeconds}s</strong></div>}
                        {hop.transitDistanceMeters > 0 && (
                          <div>Transit from Prev: <strong style={{ color: '#16a34a' }}>{hop.transitDistanceMeters}m @ {hop.calculatedSpeedKmh} km/h</strong></div>
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
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '18px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>IDENTIFIED TARGET</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                  {trajectoryData?.plateNumber || searchPlate}
                </div>
              </div>

              {vehicleHistory?.isBlacklisted && (
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  <ShieldAlert size={13} /> BLACKLIST
                </span>
              )}
            </div>

            {/* Route Summary Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #e2e8f0'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>ROUTE DISTANCE</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#2563eb' }}>
                  {trajectoryData?.totalDistanceKm || 0} km
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>AVG SPEED</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#16a34a' }}>
                  {trajectoryData?.averageSpeedKmh || 0} km/h
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>UNIQUE CAMERAS</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  {trajectoryData?.uniqueCameras || 0} Terminals
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>TOTAL SIGHTINGS</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  {trajectoryData?.totalSightings || 0} Frames
                </div>
              </div>
            </div>
          </div>

          {/* Chronological Sequence Timeline */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '18px',
            flex: 1,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.02em' }}>
              <Compass size={15} color="#2563eb" />
              CHRONOLOGICAL CAMERA SEQUENCE
            </div>

            {(!trajectoryData?.trajectory || trajectoryData.trajectory.length === 0) ? (
              <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>
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
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        border: `1px solid ${isSelected ? '#93c5fd' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        padding: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      {/* Step Number Badge */}
                      <div style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? '#2563eb' : '#eff6ff',
                        color: isSelected ? '#ffffff' : '#2563eb',
                        border: `1px solid ${isSelected ? '#2563eb' : '#bfdbfe'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        flexShrink: 0
                      }}>
                        {hop.stepIndex}
                      </div>

                      {/* Hop Details */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                            {hop.cameraName}
                          </span>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#2563eb', fontWeight: 600 }}>
                            {new Date(hop.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {hop.location}
                        </div>

                        {/* Hop Transit Metrics */}
                        {idx > 0 && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '6px',
                            fontSize: '11px',
                            color: '#64748b'
                          }}>
                            <span>Transit: <strong style={{ color: '#0f172a' }}>{hop.transitDistanceMeters}m</strong></span>
                            <span>•</span>
                            <span>Speed: <strong style={{ color: '#16a34a' }}>{hop.calculatedSpeedKmh} km/h</strong></span>
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
