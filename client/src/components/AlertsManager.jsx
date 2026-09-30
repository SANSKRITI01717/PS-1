import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  ToggleLeft, 
  ToggleRight, 
  Search, 
  Clock, 
  MapPin, 
  Camera, 
  Navigation,
  Eye,
  Check,
  RotateCcw,
  Zap,
  Filter
} from 'lucide-react';

export default function AlertsManager({ socket, onNavigateToTrajectory }) {
  const [blacklist, setBlacklist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertStatusFilter, setAlertStatusFilter] = useState('OPEN'); // 'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [blacklistForm, setBlacklistForm] = useState({
    plateNumber: '',
    reason: '',
    severity: 'CRITICAL',
    addedBy: 'Traffic Enforcement',
    notes: ''
  });

  // Fetch blacklist and alerts
  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, aRes] = await Promise.all([
        fetch('/api/blacklist'),
        fetch('/api/alerts')
      ]);

      const [bData, aData] = await Promise.all([bRes.json(), aRes.json()]);
      if (bData.success) setBlacklist(bData.data);
      if (aData.success) setAlerts(aData.data);
    } catch (err) {
      console.error('Failed to load blacklist/alerts data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (!socket) return;

    const onNewAlert = (alert) => {
      setAlerts(prev => [alert, ...prev]);
    };

    const onAlertStatusUpdated = (updated) => {
      setAlerts(prev => prev.map(a => a._id === updated._id ? updated : a));
    };

    const onBlacklistUpdated = (newEntry) => {
      setBlacklist(prev => {
        const idx = prev.findIndex(b => b.plateNumber === newEntry.plateNumber);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = newEntry;
          return copy;
        }
        return [newEntry, ...prev];
      });
    };

    socket.on('alert:new', onNewAlert);
    socket.on('alert:status-updated', onAlertStatusUpdated);
    socket.on('blacklist:updated', onBlacklistUpdated);

    return () => {
      socket.off('alert:new', onNewAlert);
      socket.off('alert:status-updated', onAlertStatusUpdated);
      socket.off('blacklist:updated', onBlacklistUpdated);
    };
  }, [socket]);

  // Add Plate to Blacklist
  const handleAddBlacklist = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blacklistForm)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to add plate to blacklist');
      } else {
        setIsAddModalOpen(false);
        setBlacklistForm({
          plateNumber: '',
          reason: '',
          severity: 'CRITICAL',
          addedBy: 'Traffic Enforcement',
          notes: ''
        });
        fetchData();
      }
    } catch (err) {
      console.error('Error adding to blacklist:', err);
    }
  };

  // Toggle Blacklist Active/Inactive
  const toggleBlacklistStatus = async (item) => {
    try {
      const newStatus = !item.isActive;
      const res = await fetch(`/api/blacklist/${item.plateNumber}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus })
      });
      if (res.ok) {
        setBlacklist(prev => prev.map(b => b.plateNumber === item.plateNumber ? { ...b, isActive: newStatus } : b));
      }
    } catch (err) {
      console.error('Failed to toggle blacklist status:', err);
    }
  };

  // Delete Blacklist Entry
  const handleDeleteBlacklist = async (plate) => {
    if (!window.confirm(`Remove vehicle '${plate}' from the active security blacklist?`)) return;
    try {
      const res = await fetch(`/api/blacklist/${plate}`, { method: 'DELETE' });
      if (res.ok) {
        setBlacklist(prev => prev.filter(b => b.plateNumber !== plate));
      }
    } catch (err) {
      console.error('Failed to delete blacklist entry:', err);
    }
  };

  // Update Alert Status (ACKNOWLEDGE or RESOLVE)
  const handleUpdateAlertStatus = async (alertId, newStatus) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, resolvedBy: 'Lead Officer' })
      });
      const data = await res.json();
      if (data.success) {
        setAlerts(prev => prev.map(a => a._id === alertId ? data.data : a));
      }
    } catch (err) {
      console.error('Failed to update alert status:', err);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (alertStatusFilter === 'ALL') return true;
    return a.status === alertStatusFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & Control Header */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626'
          }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
              Vehicle Watchlist & Security Alerts
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Watchlist vehicle flagging and security incident triage
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)',
            transition: 'background-color 0.15s ease'
          }}
        >
          <Plus size={16} /> Flag Vehicle / Blacklist
        </button>
      </div>

      {/* Main Split Grid: Blacklist Watchlist vs Security Alerts Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '20px' }}>
        
        {/* Left Column: Blacklist Watchlist */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '720px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
                ENFORCEMENT WATCHLIST ({blacklist.length})
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Vehicles flagged for immediate interception
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '9999px',
              backgroundColor: '#eff6ff',
              color: 'var(--accent-blue)',
              border: '1px solid #bfdbfe'
            }}>
              {blacklist.filter(b => b.isActive !== false).length} Active
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {blacklist.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '12px' }}>
                No vehicles currently on the city blacklist.
              </div>
            ) : (
              blacklist.map((item, idx) => (
                <div
                  key={item._id || idx}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: `1px solid ${item.isActive !== false ? '#fecaca' : 'var(--border-subtle)'}`,
                    borderLeft: item.isActive !== false ? '3px solid #dc2626' : '3px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    opacity: item.isActive !== false ? 1 : 0.65,
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '15px',
                        fontWeight: 800,
                        color: 'var(--text-main)',
                        letterSpacing: '0.04em'
                      }}>
                        {item.plateNumber}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: item.severity === 'CRITICAL' ? '#fee2e2' : item.severity === 'HIGH' ? '#fef3c7' : '#f1f5f9',
                        color: item.severity === 'CRITICAL' ? '#b91c1c' : item.severity === 'HIGH' ? '#b45309' : '#475569',
                        border: `1px solid ${item.severity === 'CRITICAL' ? '#fca5a5' : item.severity === 'HIGH' ? '#fcd34d' : '#cbd5e1'}`
                      }}>
                        {item.severity}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => toggleBlacklistStatus(item)}
                        title={item.isActive !== false ? 'Deactivate Flag' : 'Reactivate Flag'}
                        style={{ background: 'none', border: 'none', color: item.isActive !== false ? '#16a34a' : 'var(--text-faint)', cursor: 'pointer' }}
                      >
                        {item.isActive !== false ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                      <button
                        onClick={() => handleDeleteBlacklist(item.plateNumber)}
                        title="Remove from Watchlist"
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '6px', lineHeight: 1.4 }}>
                    {item.reason}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Added By: <strong>{item.addedBy}</strong></span>
                    <span>{new Date(item.createdAt || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Security & Anomaly Alerts Triage */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '720px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} color="#dc2626" />
                SECURITY & ANOMALY INCIDENTS ({filteredAlerts.length})
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Blacklist triggers and physical movement anomalies
              </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              {['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'].map(st => (
                <button
                  key={st}
                  onClick={() => setAlertStatusFilter(st)}
                  style={{
                    backgroundColor: alertStatusFilter === st ? 'var(--accent-blue)' : 'transparent',
                    color: alertStatusFilter === st ? '#ffffff' : 'var(--text-muted)',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredAlerts.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '12px' }}>
                No alerts found matching filter criteria '{alertStatusFilter}'.
              </div>
            ) : (
              filteredAlerts.map((al, idx) => (
                <div
                  key={al._id || idx}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: `1px solid ${al.severity === 'CRITICAL' ? '#fecaca' : 'var(--border-subtle)'}`,
                    borderLeft: `4px solid ${al.severity === 'CRITICAL' ? '#dc2626' : al.severity === 'HIGH' ? '#f59e0b' : '#2563eb'}`,
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: al.severity === 'CRITICAL' ? '#fee2e2' : al.severity === 'HIGH' ? '#fef3c7' : '#eff6ff',
                        color: al.severity === 'CRITICAL' ? '#b91c1c' : al.severity === 'HIGH' ? '#b45309' : '#1d4ed8',
                        border: `1px solid ${al.severity === 'CRITICAL' ? '#fca5a5' : al.severity === 'HIGH' ? '#fcd34d' : '#bfdbfe'}`
                      }}>
                        {al.severity}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {al.type}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: al.status === 'OPEN' ? '#fee2e2' : al.status === 'ACKNOWLEDGED' ? '#fef3c7' : '#dcfce7',
                      color: al.status === 'OPEN' ? '#b91c1c' : al.status === 'ACKNOWLEDGED' ? '#b45309' : '#15803d',
                      border: `1px solid ${al.status === 'OPEN' ? '#fca5a5' : al.status === 'ACKNOWLEDGED' ? '#fcd34d' : '#86efac'}`
                    }}>
                      {al.status}
                    </span>
                  </div>

                  {al.plateNumber && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Plate:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 800, color: 'var(--accent-blue)' }}>
                        {al.plateNumber}
                      </span>
                    </div>
                  )}

                  <div style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                    {al.message}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Terminal: <strong>{al.cameraId}</strong> ({al.location})</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{new Date(al.timestamp).toLocaleTimeString()}</span>
                  </div>

                  {/* Operator Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    {al.plateNumber && (
                      <button
                        onClick={() => onNavigateToTrajectory && onNavigateToTrajectory(al.plateNumber)}
                        style={{
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <Navigation size={12} /> View Trajectory
                      </button>
                    )}

                    {al.status === 'OPEN' && (
                      <button
                        onClick={() => handleUpdateAlertStatus(al._id, 'ACKNOWLEDGED')}
                        style={{
                          backgroundColor: '#fffbeb',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        Acknowledge
                      </button>
                    )}

                    {al.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleUpdateAlertStatus(al._id, 'RESOLVED')}
                        style={{
                          backgroundColor: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #bbf7d0',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <Check size={12} /> Resolve Incident
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: Add Plate to Blacklist */}
      {isAddModalOpen && (
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
            width: '440px',
            maxWidth: '90%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
              <ShieldAlert size={18} color="#dc2626" />
              Flag Vehicle on Enforcement Watchlist
            </div>

            <form onSubmit={handleAddBlacklist} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>License Plate Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DL01AB9999"
                  value={blacklistForm.plateNumber}
                  onChange={e => setBlacklistForm({ ...blacklistForm, plateNumber: e.target.value.toUpperCase() })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Flag Reason / Incident Context</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stolen luxury vehicle, wanted in highway robbery"
                  value={blacklistForm.reason}
                  onChange={e => setBlacklistForm({ ...blacklistForm, reason: e.target.value })}
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
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Severity Level</label>
                  <select
                    value={blacklistForm.severity}
                    onChange={e => setBlacklistForm({ ...blacklistForm, severity: e.target.value })}
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
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Issuing Authority</label>
                  <input
                    type="text"
                    value={blacklistForm.addedBy}
                    onChange={e => setBlacklistForm({ ...blacklistForm, addedBy: e.target.value })}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
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
                    backgroundColor: '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)'
                  }}
                >
                  Confirm Watchlist Flag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
