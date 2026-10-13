import React, { useEffect, useState } from 'react';
import { RefreshCw, Trash2, Copy, Check, ExternalLink, Link2, AlertCircle } from 'lucide-react';
import { fetchLinks, deleteLink, ShareLinkMetadata } from '../api/client';

interface Props {
  onOpenConsume?: (token: string) => void;
}

export const DashboardTab: React.FC<Props> = ({ onOpenConsume }) => {
  const [links, setLinks] = useState<ShareLinkMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadLinks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLinks();
      setLinks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load links.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this link?')) return;
    setDeletingId(id);
    try {
      await deleteLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = (token: string) => {
    const fullUrl = `${window.location.origin}/?token=${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never (Until read)';
    const d = new Date(dateStr);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStatusBadge = (status: 'Active' | 'Used' | 'Expired') => {
    if (status === 'Active') {
      return <span className="badge badge-active">Active</span>;
    }
    if (status === 'Used') {
      return <span className="badge badge-used">Used</span>;
    }
    return <span className="badge badge-expired">Expired</span>;
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="card-title">
            <Link2 size={20} color="#6366f1" />
            Link Management Dashboard
          </h2>
          <p className="card-desc" style={{ marginBottom: 0 }}>
            Inspect link lifecycle, monitor consumption, and manage active secrets.
          </p>
        </div>

        <button className="btn-secondary" onClick={loadLinks} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {links.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <Link2 size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
          <p>No one-time links created yet.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Token</th>
                <th>Created At</th>
                <th>Expires At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>{renderStatusBadge(link.status)}</td>
                  <td>
                    <code style={{ fontSize: '0.85rem', color: '#a5b4fc' }}>
                      {link.token.substring(0, 10)}...{link.token.substring(link.token.length - 4)}
                    </code>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDate(link.createdAt)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDate(link.expiresAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => handleCopy(link.token)}
                        title="Copy shareable link"
                      >
                        {copiedToken === link.token ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      </button>

                      {onOpenConsume && link.status === 'Active' && (
                        <button
                          className="btn-secondary"
                          onClick={() => onOpenConsume(link.token)}
                          title="Open & consume link"
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}

                      <button
                        className="btn-danger"
                        onClick={() => handleDelete(link.id)}
                        disabled={deletingId === link.id}
                        title="Delete link"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
