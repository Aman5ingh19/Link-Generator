import React, { useState } from 'react';
import { Send, Copy, Check, ExternalLink, ShieldAlert, Sparkles, Clock } from 'lucide-react';
import { createLink, ShareLinkMetadata } from '../api/client';

interface Props {
  onLinkCreated?: (link: ShareLinkMetadata) => void;
  onOpenConsume?: (token: string) => void;
}

export const CreateLinkTab: React.FC<Props> = ({ onLinkCreated, onOpenConsume }) => {
  const [content, setContent] = useState('');
  const [expiryOption, setExpiryOption] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<ShareLinkMetadata | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Please enter a note to generate a link.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const minutes = parseInt(expiryOption, 10);
      const res = await createLink(content, minutes > 0 ? minutes : undefined);
      setCreatedLink(res);
      setContent('');
      if (onLinkCreated) onLinkCreated(res);
    } catch (err: any) {
      setError(err.message || 'Failed to create link.');
    } finally {
      setLoading(false);
    }
  };

  const getFullShareUrl = (token: string) => {
    const origin = window.location.origin;
    return `${origin}/?token=${token}`;
  };

  const handleCopy = () => {
    if (!createdLink) return;
    const url = getFullShareUrl(createdLink.token);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="glass-card">
      <h2 className="card-title">
        <Sparkles size={20} color="#6366f1" />
        Create a Self-Destructing Link
      </h2>
      <p className="card-desc">
        Store an encrypted note that can be opened exactly once. After first access, it vanishes forever.
      </p>

      {error && (
        <div className="alert alert-danger">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Confidential Note / Secret Text</label>
          <textarea
            className="form-textarea"
            placeholder="Type your secret password, API token, sensitive instruction, or private message here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={15} />
            Optional Expiration Time
          </label>
          <select
            className="form-select"
            value={expiryOption}
            onChange={(e) => setExpiryOption(e.target.value)}
            disabled={loading}
          >
            <option value="0">Never expires (Only burns when read)</option>
            <option value="5">5 minutes</option>
            <option value="15">15 minutes</option>
            <option value="60">1 hour</option>
            <option value="1440">24 hours (1 day)</option>
            <option value="10080">7 days</option>
          </select>
        </div>

        <button type="submit" className="btn-primary" disabled={loading || !content.trim()}>
          <Send size={16} />
          {loading ? 'Generating Link...' : 'Generate One-Time Link'}
        </button>
      </form>

      {createdLink && (
        <div className="result-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#818cf8', fontWeight: 600 }}>
            <Sparkles size={18} />
            One-Time Link Ready!
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Share this URL with the recipient. The note will be permanently burned after the first view.
          </p>

          <div className="url-box">
            <input
              type="text"
              readOnly
              className="url-input"
              value={getFullShareUrl(createdLink.token)}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {onOpenConsume && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onOpenConsume(createdLink.token)}
                title="Test consuming this link"
              >
                <ExternalLink size={16} />
                Test Open
              </button>
            )}
          </div>

          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Token: <code>{createdLink.token}</code> &bull; Status: <span className="badge badge-active">Active</span>
            {createdLink.expiresAt && ` • Expires at: ${new Date(createdLink.expiresAt).toLocaleTimeString()}`}
          </div>
        </div>
      )}
    </div>
  );
};
