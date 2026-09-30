import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Cpu, 
  Database, 
  Radio, 
  Video, 
  MapPin, 
  AlertTriangle,
  Server,
  Layers,
  CheckCircle2,
  Camera,
  Navigation,
  TrendingUp,
  ShieldAlert,
  X
} from 'lucide-react';
import io from 'socket.io-client';
import CameraManager from './components/CameraManager';
import GISTrajectoryMap from './components/GISTrajectoryMap';
import CommandCenterDashboard from './components/CommandCenterDashboard';
import TrafficAnalyticsView from './components/TrafficAnalyticsView';
import AlertsManager from './components/AlertsManager';

export default function App() {
  const [backendHealth, setBackendHealth] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketInstance, setSocketInstance] = useState(null);
  const [lastPing, setLastPing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('COMMAND_CENTER'); // 'COMMAND_CENTER' | 'GIS_MAP' | 'ANALYTICS' | 'ALERTS' | 'CAMERAS' | 'ROADMAP'
  const [selectedTrajectoryPlate, setSelectedTrajectoryPlate] = useState('MP04AB1234');
  const [toastAlert, setToastAlert] = useState(null);

  useEffect(() => {
    // Health check fetch
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setBackendHealth(data);
          setLastPing(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error('Failed to connect to backend:', err);
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);

    // Socket.io connection
    const socket = io('/', { transports: ['websocket', 'polling'] });
    setSocketInstance(socket);

    socket.on('connect', () => {
      setSocketConnected(true);
    });
    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('alert:new', (alertData) => {
      setToastAlert(alertData);
      setTimeout(() => {
        setToastAlert(curr => (curr?._id === alertData._id ? null : curr));
      }, 7000);
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  const getTabStyle = (tabId, accentColor = 'var(--accent-cyan)') => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: activeTab === tabId ? 'rgba(20, 30, 51, 0.95)' : 'transparent',
    color: activeTab === tabId ? accentColor : 'var(--text-muted)',
    border: `1px solid ${activeTab === tabId ? accentColor : 'transparent'}`,
    boxShadow: activeTab === tabId ? `0 0 14px ${accentColor}33` : 'none',
    borderRadius: '6px',
    padding: '7px 14px',
    fontSize: '12px',
    fontWeight: activeTab === tabId ? 700 : 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out'
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Floating Real-Time Alert Toast */}
      {toastAlert && (
        <div className="animate-slide-in" style={{
          position: 'fixed',
          top: '76px',
          right: '24px',
          zIndex: 1000,
          backgroundColor: '#16192b',
          border: '1px solid rgba(239, 68, 68, 0.7)',
          borderRadius: '10px',
          padding: '14px 18px',
          boxShadow: '0 12px 35px rgba(239, 68, 68, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          maxWidth: '480px'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f87171',
            flexShrink: 0
          }}>
            <AlertTriangle size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#f87171', textTransform: 'uppercase' }}>
                {toastAlert.type}
              </span>
              <span style={{ fontSize: '10px', backgroundColor: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                {toastAlert.severity}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#f1f5f9', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toastAlert.message}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {toastAlert.plateNumber && (
              <button
                onClick={() => {
                  setSelectedTrajectoryPlate(toastAlert.plateNumber);
                  setActiveTab('GIS_MAP');
                  setToastAlert(null);
                }}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Track
              </button>
            )}
            <button
              onClick={() => setToastAlert(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Top Command Bar */}
      <header style={{
        height: '64px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #1d4ed8, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(6, 182, 212, 0.35)'
            }}>
              <Radio size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                CITY-WIDE ANPR & TRAFFIC INTELLIGENCE
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  PS-26127
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Command Center & Multi-Camera GIS Trajectory Engine
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
            <button
              onClick={() => setActiveTab('COMMAND_CENTER')}
              style={getTabStyle('COMMAND_CENTER', '#38bdf8')}
            >
              <Radio size={15} /> Real-Time Command Center
            </button>

            <button
              onClick={() => setActiveTab('GIS_MAP')}
              style={getTabStyle('GIS_MAP', '#22d3ee')}
            >
              <Navigation size={15} /> Multi-Camera Trajectory
            </button>

            <button
              onClick={() => setActiveTab('ANALYTICS')}
              style={getTabStyle('ANALYTICS', '#34d399')}
            >
              <TrendingUp size={15} /> Traffic Analytics & GIS Flow
            </button>

            <button
              onClick={() => setActiveTab('ALERTS')}
              style={getTabStyle('ALERTS', '#f87171')}
            >
              <ShieldAlert size={15} /> Blacklist & Alerts
            </button>

            <button
              onClick={() => setActiveTab('CAMERAS')}
              style={getTabStyle('CAMERAS', '#a78bfa')}
            >
              <Camera size={15} /> Terminals & Feeds
            </button>

            <button
              onClick={() => setActiveTab('ROADMAP')}
              style={getTabStyle('ROADMAP', '#fbbf24')}
            >
              <Layers size={15} /> PS Checklist & Architecture
            </button>
          </nav>
        </div>

        {/* Live Indicator Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: backendHealth?.status === 'ONLINE' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              boxShadow: backendHealth?.status === 'ONLINE' ? '0 0 8px #10b981' : 'none'
            }} />
            <span style={{ color: 'var(--text-muted)' }}>Backend:</span>
            <span style={{ fontWeight: 600, color: backendHealth?.status === 'ONLINE' ? '#34d399' : '#f87171' }}>
              {backendHealth?.status || 'CONNECTING...'}
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: socketConnected ? 'var(--accent-cyan)' : 'var(--accent-amber)',
              boxShadow: socketConnected ? '0 0 8px #06b6d4' : 'none'
            }} />
            <span style={{ color: 'var(--text-muted)' }}>Socket.IO:</span>
            <span style={{ fontWeight: 600, color: socketConnected ? '#22d3ee' : '#fbbf24' }}>
              {socketConnected ? 'STREAM ACTIVE' : 'RECONNECTING'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, padding: '24px', maxWidth: '1540px', width: '100%', margin: '0 auto' }}>
        {activeTab === 'COMMAND_CENTER' ? (
          <CommandCenterDashboard 
            socket={socketInstance} 
            onNavigateToTrajectory={(plate) => {
              setSelectedTrajectoryPlate(plate);
              setActiveTab('GIS_MAP');
            }}
          />
        ) : activeTab === 'GIS_MAP' ? (
          <GISTrajectoryMap initialPlate={selectedTrajectoryPlate} />
        ) : activeTab === 'ANALYTICS' ? (
          <TrafficAnalyticsView />
        ) : activeTab === 'ALERTS' ? (
          <AlertsManager 
            socket={socketInstance} 
            onNavigateToTrajectory={(plate) => {
              setSelectedTrajectoryPlate(plate);
              setActiveTab('GIS_MAP');
            }} 
          />
        ) : activeTab === 'CAMERAS' ? (
          <CameraManager socket={socketInstance} />
        ) : (
          <>
            {/* Banner Section */}
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
            }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px', color: '#f8fafc' }}>
                  SIH 26127: Full-Spectrum City-Wide ANPR & Traffic Intelligence Engine
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '820px', lineHeight: 1.6 }}>
                  Integrated AI inference, multi-camera vehicle trajectory mapping, real-time command center telemetry, empirical traffic density analytics, GIS heatmaps, and automated blacklist/anomaly enforcement.
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.05em' }}>
                  System Heartbeat
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                  {lastPing || 'Awaiting sync...'}
                </div>
              </div>
            </div>





        {/* System Architecture Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          marginBottom: '28px'
        }}>
          {/* Card 1: AI Model */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}>
                <Cpu size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>Existing ANPR/OCR Engine</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Verified & Retained</div>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Detection Model:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>custom_trained_model.pt</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>OCR Pipeline:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>cct-xs-v2-global-model</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Plate Formatting:</span>
                <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>Standard Indian Formats</span>
              </div>
            </div>
          </div>

          {/* Card 2: Backend */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
                <Server size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>Node.js + Express Backend</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Port 5000 (Active)</div>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Runtime:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Node.js v24 + Express</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Real-Time Events:</span>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 500 }}>Socket.IO Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>API Architecture:</span>
                <span style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>Modular REST + WebSockets</span>
              </div>
            </div>
          </div>

          {/* Card 3: Database Foundation */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}>
                <Database size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>Database Layer</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mongoose + Resilient Storage</div>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Storage Target:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>MongoDB Atlas / Local</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Hybrid Resiliency:</span>
                <span style={{ color: 'var(--accent-emerald)', fontWeight: 500 }}>Zero-Crash Failover</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Planned Models:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>8 Indexed Collections</span>
              </div>
            </div>
          </div>
        </div>

        {/* Phase Roadmap Checklist */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#06b6d4" />
            12-Phase SIH Implementation Roadmap
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px'
          }}>
            {[
              { phase: 'Phase 1', title: 'Project Audit & Foundation', status: 'COMPLETED', color: '#10b981' },
              { phase: 'Phase 2', title: 'Node.js Backend + 8 DB Models & APIs', status: 'COMPLETED', color: '#10b981' },
              { phase: 'Phase 3', title: 'Existing ANPR/OCR Pipeline Integration', status: 'COMPLETED', color: '#10b981' },
              { phase: 'Phase 4', title: 'Camera Management & Live Feed Ingestion', status: 'COMPLETED', color: '#10b981' },
              { phase: 'Phase 5', title: 'Multi-Camera Trajectory Engine', status: 'COMPLETED', color: '#10b981' },
              { phase: 'Phase 6', title: 'GIS Trajectory & Polyline Map Visualizer', status: 'COMPLETED', color: '#10b981' },
              { phase: 'Phase 7', title: 'Real-Time Command Center Dashboard', status: 'COMPLETED', color: '#10b981' },
              { phase: 'Phase 8', title: 'Urban Traffic Analytics Engine', status: 'COMPLETED', color: '#10b981' },
              { phase: 'Phase 9', title: 'Advanced Heatmaps & Congestion Analytics', status: 'COMPLETED', color: '#10b981' },
              { phase: 'Phase 10', title: 'Blacklist & Anomaly Alert Engine', status: 'COMPLETED', color: '#10b981' },
              { phase: 'Phase 11', title: 'Enterprise UX Polish & Theme System', status: 'COMPLETED', color: '#10b981' },
              { phase: 'Phase 12', title: 'PS 26127 End-to-End Verification', status: 'COMPLETED & VERIFIED', color: '#10b981' },
            ].map((p, idx) => (
              <div key={idx} style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{p.phase}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>{p.title}</div>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: `${p.color}15`,
                  color: p.color,
                  border: `1px solid ${p.color}40`
                }}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
        </>
        )}
      </main>
    </div>
  );
}
