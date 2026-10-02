import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  AlertTriangle,
  Camera,
  Navigation,
  TrendingUp,
  ShieldAlert,
  UploadCloud,
  X
} from 'lucide-react';
import io from 'socket.io-client';
import CameraManager from './components/CameraManager';
import GISTrajectoryMap from './components/GISTrajectoryMap';
import CommandCenterDashboard from './components/CommandCenterDashboard';
import TrafficAnalyticsView from './components/TrafficAnalyticsView';
import AlertsManager from './components/AlertsManager';
import UploadDetect from './components/UploadDetect';

export default function App() {
  const [backendHealth, setBackendHealth] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketInstance, setSocketInstance] = useState(null);
  const [lastPing, setLastPing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('COMMAND_CENTER'); // 'COMMAND_CENTER' | 'GIS_MAP' | 'ANALYTICS' | 'ALERTS' | 'CAMERAS' | 'UPLOAD' | 'ROADMAP'
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
    const socket = io(import.meta.env.VITE_API_URL || '/', { transports: ['websocket', 'polling'] });
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

  const getTabStyle = (tabId) => {
    const isActive = activeTab === tabId;
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      backgroundColor: isActive ? '#eff6ff' : 'transparent',
      color: isActive ? '#1d4ed8' : '#475569',
      border: `1px solid ${isActive ? '#bfdbfe' : 'transparent'}`,
      boxShadow: isActive ? '0 1px 2px rgba(37, 99, 235, 0.08)' : 'none',
      borderRadius: '6px',
      padding: '6px 11px',
      fontSize: '12px',
      fontWeight: isActive ? 600 : 500,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      transition: 'all 0.15s ease'
    };
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* Floating Real-Time Alert Toast */}
      {toastAlert && (
        <div className="animate-slide-in" style={{
          position: 'fixed',
          top: '68px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: '#ffffff',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          padding: '12px 16px',
          boxShadow: '0 10px 25px -5px rgba(220, 38, 38, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '460px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626',
            flexShrink: 0
          }}>
            <AlertTriangle size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>
                {toastAlert.type}
              </span>
              <span style={{ fontSize: '10px', backgroundColor: '#fef2f2', color: '#dc2626', padding: '1px 5px', borderRadius: '3px', fontWeight: 700, border: '1px solid #fecaca' }}>
                {toastAlert.severity}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
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
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Top Command Bar */}
      <header style={{
        height: '58px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)',
        gap: '12px'
      }}>
        {/* Left Branding Area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '7px',
            backgroundColor: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(37, 99, 235, 0.25)',
            flexShrink: 0
          }}>
            <Radio size={17} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', lineHeight: 1.2 }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                CITY-WIDE ANPR
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: '4px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                whiteSpace: 'nowrap'
              }}>
                PS 26127
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', marginTop: '1px' }}>
              Command Center & GIS Engine
            </div>
          </div>
        </div>

        {/* Center Horizontal Navigation */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          padding: '2px 0'
        }}>
          <button
            onClick={() => setActiveTab('COMMAND_CENTER')}
            style={getTabStyle('COMMAND_CENTER')}
          >
            <Radio size={14} /> Real-Time Command Center
          </button>

          <button
            onClick={() => setActiveTab('GIS_MAP')}
            style={getTabStyle('GIS_MAP')}
          >
            <Navigation size={14} /> Multi-Camera Trajectory
          </button>

          <button
            onClick={() => setActiveTab('ANALYTICS')}
            style={getTabStyle('ANALYTICS')}
          >
            <TrendingUp size={14} /> Traffic Analytics & GIS
          </button>

          <button
            onClick={() => setActiveTab('ALERTS')}
            style={getTabStyle('ALERTS')}
          >
            <ShieldAlert size={14} /> Blacklist & Alerts
          </button>

          <button
            onClick={() => setActiveTab('CAMERAS')}
            style={getTabStyle('CAMERAS')}
          >
            <Camera size={14} /> Terminals & Feeds
          </button>

          <button
            onClick={() => setActiveTab('UPLOAD')}
            style={getTabStyle('UPLOAD')}
          >
            <UploadCloud size={14} /> Upload & Detect
          </button>
        </nav>

        {/* Right Status Indicator Area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 9px',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            fontSize: '11px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            whiteSpace: 'nowrap'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: backendHealth?.status === 'ONLINE' ? '#16a34a' : '#dc2626'
            }} />
            <span style={{ color: '#64748b' }}>Backend:</span>
            <span style={{ fontWeight: 600, color: backendHealth?.status === 'ONLINE' ? '#16a34a' : '#dc2626' }}>
              {backendHealth?.status || 'ONLINE'}
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 9px',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            fontSize: '11px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
            whiteSpace: 'nowrap'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: socketConnected ? '#2563eb' : '#d97706'
            }} />
            <span style={{ color: '#64748b' }}>Socket.IO:</span>
            <span style={{ fontWeight: 600, color: socketConnected ? '#2563eb' : '#d97706' }}>
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
        ) : activeTab === 'UPLOAD' ? (
          <UploadDetect
            onNavigateToTrajectory={(plate) => {
              setSelectedTrajectoryPlate(plate);
              setActiveTab('GIS_MAP');
            }}
          />
        ) : (
          <CameraManager socket={socketInstance} />
        )}
      </main>
    </div>
  );
}
