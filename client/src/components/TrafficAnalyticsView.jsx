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
        backgroundColor: 'rgba(6, 182, 212, 0.45)',
        borderColor: '#06b6d4',
        borderWidth: 2,
        borderRadius: 4,
        tension: 0.35,
        fill: true
      }
    ]
  };

  const hourlyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#38bdf8',
        bodyColor: '#f8fafc',
        borderColor: '#334155',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { size: 10, family: 'monospace' }, maxRotation: 0 }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { size: 10, family: 'monospace' }, stepSize: 1 }
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
          '#38bdf8',
          '#10b981',
          '#f59e0b',
          '#818cf8',
          '#ec4899',
          '#06b6d4'
        ],
        borderRadius: 4
      }
    ]
  };

  // Map Coordinates & Center
  const defaultCenter = [28.4735, 77.075];
  const mapBounds = densityData?.densityRanking?.filter(c => c.coordinates).map(c => [c.coordinates.lat, c.coordinates.lng]) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Filter and Controls Header */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: 'rgba(6, 182, 212, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)'
          }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
              City-Wide Traffic Analytics & Flow Intelligence
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Empirical density heatmaps, bottleneck delays, corridor speeds, and O-D travel patterns
            </div>
          </div>
        </div>

        {/* Time Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TIMEFRAME:</span>
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
                backgroundColor: timeFilter === f.id ? 'var(--accent-blue)' : 'var(--bg-card)',
                color: timeFilter === f.id ? '#ffffff' : 'var(--text-muted)',
                border: `1px solid ${timeFilter === f.id ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
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
        backgroundColor: '#0a0f1d',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Layer Controls Bar */}
        <div style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          zIndex: 1000,
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '11px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: 'var(--text-main)' }}>
            <input type="checkbox" checked={showHeatCircles} onChange={e => setShowHeatCircles(e.target.checked)} />
            Density Heatmaps
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: 'var(--text-main)' }}>
            <input type="checkbox" checked={showFlowLines} onChange={e => setShowFlowLines(e.target.checked)} />
            Corridor Flow Lines
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: 'var(--text-main)' }}>
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
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '11px' }}>FLOW DENSITY SCALE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '4px', backgroundColor: '#10b981', borderRadius: '2px' }} />
            <span style={{ color: 'var(--text-muted)' }}>Free Flow (&gt;35 km/h)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '4px', backgroundColor: '#f59e0b', borderRadius: '2px' }} />
            <span style={{ color: 'var(--text-muted)' }}>Moderate Transit (20-35 km/h)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '4px', backgroundColor: '#ef4444', borderRadius: '2px' }} />
            <span style={{ color: 'var(--text-muted)' }}>Congested / Bottleneck (&lt;20 km/h)</span>
          </div>
        </div>

        {/* Leaflet Map */}
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

          <MapAutoFit bounds={mapBounds} />

          {/* 1. Traffic Density Heat Circles */}
          {showHeatCircles && densityData?.densityRanking?.map(cam => {
            if (!cam.coordinates) return null;
            const radius = Math.max(20, Math.min(65, (cam.detectionCount || 1) * 8));
            const color = cam.densityLevel === 'CONGESTED' ? '#ef4444' : cam.densityLevel === 'HIGH' ? '#f59e0b' : '#10b981';

            return (
              <CircleMarker
                key={`heat-${cam.cameraId}`}
                center={[cam.coordinates.lat, cam.coordinates.lng]}
                radius={radius}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.25,
                  weight: 1.5
                }}
              >
                <Popup>
                  <div style={{ padding: '4px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>JUNCTION DENSITY</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>{cam.cameraName}</div>
                    <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px' }}>
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
            const color = seg.averageSpeedKmh < 20 ? '#ef4444' : seg.averageSpeedKmh < 35 ? '#f59e0b' : '#38bdf8';
            const weight = Math.min(8, Math.max(3, seg.vehicleCount * 1.8));

            return (
              <Polyline
                key={`flow-${seg.segmentId}`}
                positions={positions}
                pathOptions={{ color, weight, opacity: 0.85 }}
              >
                <Popup>
                  <div style={{ padding: '4px' }}>
                    <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>ROAD CORRIDOR</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                      {seg.fromCameraName} → {seg.toCameraName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                      Distance: <strong>{seg.distanceMeters}m</strong> | Speed: <strong style={{ color }}>{seg.averageSpeedKmh} km/h</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
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
                radius={50}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.35,
                  weight: 2,
                  dashArray: '6, 6'
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Grid of 4 Data Visualization Panels Below the Map */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '20px' }}>
        
        {/* Panel 1: Hourly Traffic Trends Histogram */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="var(--accent-cyan)" />
                24-Hour Traffic Trend Histogram
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Temporal distribution of plate detections across the city
              </div>
            </div>
            {trafficSummary?.peakTrafficHour && (
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(6, 182, 212, 0.12)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(6, 182, 212, 0.3)'
              }}>
                Peak: {trafficSummary.peakTrafficHour}
              </span>
            )}
          </div>

          <div style={{ height: '220px', width: '100%' }}>
            <Line data={hourlyChartData} options={hourlyChartOptions} />
          </div>
        </div>

        {/* Panel 2: Camera Volume Comparison */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={16} color="#38bdf8" />
                Terminal Volume Comparison
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Detection load distribution by surveillance terminal
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {densityData?.totalCamerasEvaluated || 0} Nodes
            </span>
          </div>

          <div style={{ height: '220px', width: '100%' }}>
            <Bar data={cameraComparisonData} options={hourlyChartOptions} />
          </div>
        </div>

        {/* Panel 3: Speed Distribution & Violation Analysis */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gauge size={16} color="var(--accent-emerald)" />
                Corridor Speed & Violation Analysis
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Calculated transit velocities vs urban speed limit (60 km/h)
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#34d399'
            }}>
              Avg {speedData?.overallAverageSpeedKmh || 0} km/h
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '220px' }}>
            {speedData?.corridorSpeeds?.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center', padding: '30px' }}>
                Insufficient data for corridor speed distribution.
              </div>
            ) : (
              speedData?.corridorSpeeds?.map((c, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{c.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Distance: {c.transitDistanceMeters}m | Avg Duration: {c.travelTimeSeconds}s
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: c.averageSpeedKmh > 60 ? '#f87171' : 'var(--accent-emerald)'
                    }}>
                      {c.averageSpeedKmh} km/h
                    </div>
                    {c.averageSpeedKmh > 60 && (
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#f87171' }}>SPEED VIOLATION</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel 4: Origin-Destination Matrix & Congestion Bottlenecks */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={16} color="#818cf8" />
                Origin-Destination (O-D) Transit Pairs
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Empirical trip origins and destinations with average trip duration
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {odData?.totalODTripsAnalyzed || 0} Trips
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '220px' }}>
            {(!odData?.odPairs || odData.odPairs.length === 0) ? (
              <div style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center', padding: '30px' }}>
                {odData?.message || 'Insufficient data for O-D analysis.'}
              </div>
            ) : (
              odData.odPairs.map((pair, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {pair.originName}
                    </span>
                    <ArrowRight size={13} color="var(--accent-cyan)" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {pair.destinationName}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
                      {pair.tripCount} {pair.tripCount === 1 ? 'Trip' : 'Trips'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
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
