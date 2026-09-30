import React, { useState, useEffect } from 'react';
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
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { 
  BarChart3, 
  Layers, 
  Flame, 
  Gauge, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  Filter, 
  Compass, 
  Calendar,
  Camera,
  Activity,
  ArrowRight
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Map bounds auto-fit
function MapAutoFit({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [bounds, map]);
  return null;
}

export default function TrafficAnalyticsView() {
  const [timeFilter, setTimeFilter] = useState('24H'); // 'TODAY' | '24H' | '7D' | 'ALL'
  const [selectedCameraFilter, setSelectedCameraFilter] = useState('ALL');
  
  // Backend analytics states
  const [trafficSummary, setTrafficSummary] = useState(null);
  const [densityData, setDensityData] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [speedData, setSpeedData] = useState(null);
  const [odData, setOdData] = useState(null);
  const [congestionData, setCongestionData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Map Layer Toggles
  const [showHeatCircles, setShowHeatCircles] = useState(true);
  const [showFlowLines, setShowFlowLines] = useState(true);
  const [showCongestionAlerts, setShowCongestionAlerts] = useState(true);
  const [showODLines, setShowODLines] = useState(false);

  // Fetch all analytics data from backend
  const fetchAllAnalytics = async () => {
    setLoading(true);
    try {
      const [tRes, dRes, rRes, sRes, odRes, cRes] = await Promise.all([
        fetch('/api/analytics/traffic'),
        fetch('/api/analytics/density'),
        fetch('/api/analytics/routes'),
        fetch('/api/analytics/speed'),
        fetch('/api/analytics/origin-destination'),
        fetch('/api/analytics/congestion')
      ]);

      const [traffic, density, routes, speed, od, congestion] = await Promise.all([
        tRes.json(),
        dRes.json(),
        rRes.json(),
        sRes.json(),
        odRes.json(),
        cRes.json()
      ]);

      setTrafficSummary(traffic);
      setDensityData(density);
      setRouteData(routes);
      setSpeedData(speed);
      setOdData(od);
      setCongestionData(congestion);
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAnalytics();
  }, [timeFilter]);

  // Hourly Trend Chart Data
  const hourlyLabels = trafficSummary?.hourlyTrends?.map(h => h.hour) || [];
  const hourlyCounts = trafficSummary?.hourlyTrends?.map(h => h.count) || [];

  const hourlyChartData = {
    labels: hourlyLabels,
    datasets: [
      {
        label: 'Hourly Volume',
        data: hourlyCounts,
        backgroundColor: 'rgba(37, 99, 235, 0.10)',
        borderColor: '#2563eb',
        borderWidth: 2,
        borderRadius: 4,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#2563eb',
        pointRadius: 3
      }
    ]
  };

  const lightChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#0f172a',
        bodyColor: '#475569',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true
      }
    },
    scales: {
      x: {
        grid: { color: '#f1f5f9' },
        ticks: { color: '#64748b', font: { size: 10, family: 'var(--font-mono)' }, maxRotation: 0 }
      },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: { color: '#64748b', font: { size: 10, family: 'var(--font-mono)' }, stepSize: 1 }
      }
    }
  };

  // Camera Comparison Chart Data
  const cameraLabels = densityData?.densityRanking?.map(c => c.cameraName.split(' ')[0] + ' ' + (c.cameraName.split(' ')[1] || '')) || [];
  const cameraCounts = densityData?.densityRanking?.map(c => c.detectionCount) || [];

  const cameraComparisonData = {
    labels: cameraLabels,
    datasets: [
      {
        label: 'Total Sightings',
        data: cameraCounts,
        backgroundColor: [
          '#2563eb',
          '#0284c7',
          '#0d9488',
          '#16a34a',
          '#d97706',
          '#7c3aed'
        ],
        borderRadius: 4
      }
    ]
  };

  // Map Coordinates & Center
  const defaultCenter = [28.4735, 77.075];
  const mapBounds = densityData?.densityRanking?.filter(c => c.coordinates).map(c => [c.coordinates.lat, c.coordinates.lng]) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Filter and Controls Header */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2563eb'
          }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              City-Wide Traffic Analytics & Flow Intelligence
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Empirical density heatmaps, bottleneck delays, corridor speeds, and O-D travel patterns
            </div>
          </div>
        </div>

        {/* Time Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TIMEFRAME:</span>
          {[
            { id: 'TODAY', label: 'Today' },
            { id: '24H', label: 'Last 24 Hours' },
            { id: '7D', label: 'Last 7 Days' },
            { id: 'ALL', label: 'All Records' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setTimeFilter(f.id)}
              style={{
                backgroundColor: timeFilter === f.id ? '#eff6ff' : '#ffffff',
                color: timeFilter === f.id ? '#2563eb' : '#475569',
                border: `1px solid ${timeFilter === f.id ? '#bfdbfe' : '#e2e8f0'}`,
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Centerpiece GIS Map on Top, Analytics Charts Below */}
      <div style={{
        position: 'relative',
        height: '480px',
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Layer Controls Bar */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 1000,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '11px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          color: '#0f172a'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showHeatCircles} onChange={e => setShowHeatCircles(e.target.checked)} />
            Density Heatmaps
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showFlowLines} onChange={e => setShowFlowLines(e.target.checked)} />
            Corridor Flow Lines
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showCongestionAlerts} onChange={e => setShowCongestionAlerts(e.target.checked)} />
            Congestion Zones
          </label>
        </div>

        {/* Legend Widget on Map */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          zIndex: 1000,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
        }}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '11px' }}>FLOW DENSITY SCALE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '4px', backgroundColor: '#16a34a', borderRadius: '2px' }} />
            <span style={{ color: '#475569' }}>Free Flow (&gt;35 km/h)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '4px', backgroundColor: '#d97706', borderRadius: '2px' }} />
            <span style={{ color: '#475569' }}>Moderate Transit (20-35 km/h)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '4px', backgroundColor: '#dc2626', borderRadius: '2px' }} />
            <span style={{ color: '#475569' }}>Congested / Bottleneck (&lt;20 km/h)</span>
          </div>
        </div>

        {/* Leaflet Map with Light Tiles */}
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

          {/* 1. Traffic Density Heat Circles */}
          {showHeatCircles && densityData?.densityRanking?.map(cam => {
            if (!cam.coordinates) return null;
            const radius = Math.max(18, Math.min(60, (cam.detectionCount || 1) * 7));
            const color = cam.densityLevel === 'CONGESTED' ? '#dc2626' : cam.densityLevel === 'HIGH' ? '#d97706' : '#16a34a';

            return (
              <CircleMarker
                key={`heat-${cam.cameraId}`}
                center={[cam.coordinates.lat, cam.coordinates.lng]}
                radius={radius}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.20,
                  weight: 1.5
                }}
              >
                <Popup>
                  <div style={{ padding: '4px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>JUNCTION DENSITY</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{cam.cameraName}</div>
                    <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px' }}>
                      Volume: <strong>{cam.detectionCount} sightings</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: color, fontWeight: 700, marginTop: '2px' }}>
                      Status: {cam.densityLevel} ({cam.capacityUtilizationPercentage}% capacity)
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* 2. Corridor Flow Lines */}
          {showFlowLines && routeData?.segments?.map(seg => {
            if (!seg.fromCoordinates || !seg.toCoordinates) return null;
            const positions = [
              [seg.fromCoordinates.lat, seg.fromCoordinates.lng],
              [seg.toCoordinates.lat, seg.toCoordinates.lng]
            ];
            const color = seg.averageSpeedKmh < 20 ? '#dc2626' : seg.averageSpeedKmh < 35 ? '#d97706' : '#2563eb';
            const weight = Math.min(7, Math.max(3, seg.vehicleCount * 1.6));

            return (
              <Polyline
                key={`flow-${seg.segmentId}`}
                positions={positions}
                pathOptions={{ color, weight, opacity: 0.85 }}
              >
                <Popup>
                  <div style={{ padding: '4px' }}>
                    <div style={{ fontSize: '10px', color: '#2563eb', fontWeight: 700 }}>ROAD CORRIDOR</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {seg.fromCameraName} → {seg.toCameraName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                      Distance: <strong>{seg.distanceMeters}m</strong> | Speed: <strong style={{ color }}>{seg.averageSpeedKmh} km/h</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Vehicle Count: {seg.vehicleCount} | Est. Travel Time: {seg.averageTravelTimeSeconds}s
                    </div>
                  </div>
                </Popup>
              </Polyline>
            );
          })}

          {/* 3. Congestion Bottleneck Buffer Zones */}
          {showCongestionAlerts && congestionData?.congestedJunctions?.map(j => {
            if (!j.coordinates) return null;
            return (
              <CircleMarker
                key={`congest-${j.cameraId}`}
                center={[j.coordinates.lat, j.coordinates.lng]}
                radius={45}
                pathOptions={{
                  color: '#dc2626',
                  fillColor: '#dc2626',
                  fillOpacity: 0.25,
                  weight: 1.5,
                  dashArray: '5, 5'
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Grid of 4 Data Visualization Panels Below the Map */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '16px' }}>
        
        {/* Panel 1: Hourly Traffic Trends Histogram */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#2563eb" />
                24-Hour Traffic Trend Histogram
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Temporal distribution of plate detections across the city
              </div>
            </div>
            {trafficSummary?.peakTrafficHour && (
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe'
              }}>
                Peak: {trafficSummary.peakTrafficHour}
              </span>
            )}
          </div>

          <div style={{ height: '220px', width: '100%' }}>
            <Line data={hourlyChartData} options={lightChartOptions} />
          </div>
        </div>

        {/* Panel 2: Camera Volume Comparison */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={16} color="#0284c7" />
                Terminal Volume Comparison
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Detection load distribution by surveillance terminal
              </div>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {densityData?.totalCamerasEvaluated || 0} Nodes
            </span>
          </div>

          <div style={{ height: '220px', width: '100%' }}>
            <Bar data={cameraComparisonData} options={lightChartOptions} />
          </div>
        </div>

        {/* Panel 3: Speed Distribution & Violation Analysis */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gauge size={16} color="#16a34a" />
                Corridor Speed & Violation Analysis
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Calculated transit velocities vs urban speed limit (60 km/h)
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              border: '1px solid #bbf7d0'
            }}>
              Avg {speedData?.overallAverageSpeedKmh || 0} km/h
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '220px' }}>
            {speedData?.corridorSpeeds?.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '30px' }}>
                Insufficient data for corridor speed distribution.
              </div>
            ) : (
              speedData?.corridorSpeeds?.map((c, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                      Distance: {c.transitDistanceMeters}m | Avg Duration: {c.travelTimeSeconds}s
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: c.averageSpeedKmh > 60 ? '#dc2626' : '#16a34a'
                    }}>
                      {c.averageSpeedKmh} km/h
                    </div>
                    {c.averageSpeedKmh > 60 && (
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#dc2626' }}>SPEED VIOLATION</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel 4: Origin-Destination Matrix */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={16} color="#7c3aed" />
                Origin-Destination (O-D) Transit Pairs
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Empirical trip origins and destinations with average trip duration
              </div>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {odData?.totalODTripsAnalyzed || 0} Trips
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '220px' }}>
            {(!odData?.odPairs || odData.odPairs.length === 0) ? (
              <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '30px' }}>
                {odData?.message || 'Insufficient data for O-D analysis.'}
              </div>
            ) : (
              odData.odPairs.map((pair, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                      {pair.originName}
                    </span>
                    <ArrowRight size={13} color="#2563eb" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                      {pair.destinationName}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
                      {pair.tripCount} {pair.tripCount === 1 ? 'Trip' : 'Trips'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>
                      Avg {pair.averageTripDurationMinutes}m ({pair.distanceMeters}m)
                    </div>
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
