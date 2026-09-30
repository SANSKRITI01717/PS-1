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
    addedBy: 'State Police Cyber Cell',
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
          addedBy: 'State Police Cyber Cell',
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
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f87171'
          }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
              Blacklist Watchlist & Anomaly Alert Center
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Automated plate lookup, rapid transit detection, speed violations, and incident triage
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)'
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
          maxHeight: '720px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                ENFORCEMENT WATCHLIST ({blacklist.length})
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Vehicles flagged for immediate interception
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>
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
                    border: `1px solid ${item.isActive !== false ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'}`,
                    borderRadius: '8px',
                    padding: '12px 14px',
                    opacity: item.isActive !== false ? 1 : 0.6
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '15px',
                        fontWeight: 800,
                        color: item.isActive !== false ? '#ffffff' : 'var(--text-muted)'
                      }}>
                        {item.plateNumber}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: item.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: item.severity === 'CRITICAL' ? '#f87171' : '#fbbf24',
                        border: `1px solid ${item.severity === 'CRITICAL' ? '#f87171' : '#fbbf24'}40`
                      }}>
                        {item.severity}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => toggleBlacklistStatus(item)}
                        title={item.isActive !== false ? 'Deactivate Flag' : 'Reactivate Flag'}
                        style={{ background: 'none', border: 'none', color: item.isActive !== false ? '#34d399' : 'var(--text-faint)', cursor: 'pointer' }}
                      >
                        {item.isActive !== false ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                      <button
                        onClick={() => handleDeleteBlacklist(item.plateNumber)}
                        title="Remove from Watchlist"
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '6px' }}>
                    {item.reason}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '10px', color: 'var(--text-faint)' }}>
                    <span>Added By: {item.addedBy}</span>
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
          maxHeight: '720px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} color="#f87171" />
                SECURITY & ANOMALY INCIDENTS ({filteredAlerts.length})
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Blacklist triggers and physical movement anomalies
              </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-primary)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
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
                    cursor: 'pointer'
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
                    border: `1px solid ${al.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)'}`,
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: al.severity === 'CRITICAL' ? '#ef4444' : al.severity === 'HIGH' ? '#f59e0b' : '#3b82f6',
                        color: '#ffffff'
                      }}>
                        {al.severity}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                        {al.type}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: al.status === 'OPEN' ? 'rgba(239, 68, 68, 0.15)' : al.status === 'ACKNOWLEDGED' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: al.status === 'OPEN' ? '#f87171' : al.status === 'ACKNOWLEDGED' ? '#fbbf24' : '#34d399'
                    }}>
                      {al.status}
                    </span>
                  </div>

                  {al.plateNumber && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Plate:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                        {al.plateNumber}
                      </span>
                    </div>
                  )}

                  <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: 1.5 }}>
                    {al.message}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: 'var(--text-faint)' }}>
                    <span>Terminal: {al.cameraId} ({al.location})</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{new Date(al.timestamp).toLocaleTimeString()}</span>
                  </div>

                  {/* Operator Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    {al.plateNumber && (
                      <button
                        onClick={() => onNavigateToTrajectory && onNavigateToTrajectory(al.plateNumber)}
                        style={{
                          backgroundColor: 'rgba(56, 189, 248, 0.12)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Navigation size={12} /> View Trajectory
                      </button>
                    )}

                    {al.status === 'OPEN' && (
                      <button
                        onClick={() => handleUpdateAlertStatus(al._id, 'ACKNOWLEDGED')}
                        style={{
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: '#fbbf24',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Acknowledge
                      </button>
                    )}

                    {al.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleUpdateAlertStatus(al._id, 'RESOLVED')}
                        style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
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
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            width: '440px',
            maxWidth: '90%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="#ef4444" />
              Flag Vehicle on Enforcement Watchlist
            </div>

            <form onSubmit={handleAddBlacklist} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>License Plate Number</label>
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
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Flag Reason / Incident Context</label>
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
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Severity Level</label>
                  <select
                    value={blacklistForm.severity}
                    onChange={e => setBlacklistForm({ ...blacklistForm, severity: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
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
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Issuing Authority</label>
                  <input
                    type="text"
                    value={blacklistForm.addedBy}
                    onChange={e => setBlacklistForm({ ...blacklistForm, addedBy: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-subtle)',
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
                    backgroundColor: '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
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
