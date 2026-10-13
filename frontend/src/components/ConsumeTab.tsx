import React, { useState, useEffect } from 'react';
import { Eye, ShieldAlert, Check, Copy, Flame, AlertTriangle, ArrowRight } from 'lucide-react';
import { consumeLink } from '../api/client';

interface Props {
  initialToken?: string;
  onClearToken?: () => void;
}

export const ConsumeTab: React.FC<Props> = ({ initialToken = '', onClearToken }) => {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [revealedContent, setRevealedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialToken) {
      setTokenInput(initialToken);
      setRevealedContent(null);
      setErrorStatus(null);
      setErrorMessage(null);
    }
  }, [initialToken]);

  const handleConsume = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;

    setLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);

    try {
      const res = await consumeLink(token);
      if (res.success && res.content !== undefined) {
        setRevealedContent(res.content);
      } else {
        setErrorStatus(res.error || 'ERROR');
        setErrorMessage(res.message || 'Unable to access link.');
      }
    } catch (err: any) {
      setErrorStatus('CLIENT_ERROR');
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (!revealedContent) return;
    navigator.clipboard.writeText(revealedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card">
      <h2 className="card-title">
        <Flame size={20} color="#f59e0b" />
        Access One-Time Note
      </h2>
      <p className="card-desc">
        Opening this link retrieves the secret message and permanently incinerates it from the database.
      </p>

      {/* Token Input Form (if no token prefilled or user wants to enter one manually) */}
      {!revealedContent && !errorStatus && (
        <form onSubmit={handleConsume}>
          <div className="alert alert-warning">
            <AlertTriangle size={20} />
            <div>
              <strong>Single-Access Warning:</strong> Once opened, this link is destroyed instantly.
              Do not refresh or close before copying your content!
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Link Token</label>
            <input
              type="text"
              className="form-textarea"
              style={{ minHeight: 'auto', height: '48px' }}
              placeholder="e.g. 5d92e6f47b2c019a84a3..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            disabled={loading || !tokenInput.trim()}
          >
            <Eye size={16} />
            {loading ? 'Decrypting & Burning...' : 'Reveal & Consume Secret'}
          </button>
        </form>
      )}

      {/* Successfully revealed note */}
      {revealedContent !== null && (
        <div>
          <div className="alert alert-info">
            <Flame size={20} color="#f97316" />
            <div>
              <strong>Secret Revealed &amp; Burned:</strong> This link has been permanently consumed and marked as used.
              Subsequent access attempts will be rejected.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confidential Message</label>
            <div className="reveal-box">{revealedContent}</div>
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={handleCopySecret}>
              {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              {copied ? 'Copied Note!' : 'Copy Note'}
            </button>

            {onClearToken && (
              <button
                className="btn-secondary"
                onClick={() => {
                  setRevealedContent(null);
                  setTokenInput('');
                  onClearToken();
                }}
              >
                Consume Another Link <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error state: Already used, Expired, or Not Found */}
      {errorStatus && (
        <div>
          <div className="alert alert-danger">
            <ShieldAlert size={24} />
            <div>
              <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '0.25rem' }}>
                {errorStatus === 'ALREADY_USED' && 'This link has already been used.'}
                {errorStatus === 'EXPIRED' && 'This link has expired.'}
                {errorStatus === 'NOT_FOUND' && 'Link not found or invalid.'}
                {errorStatus !== 'ALREADY_USED' && errorStatus !== 'EXPIRED' && errorStatus !== 'NOT_FOUND' && errorMessage}
              </strong>
              <span>
                {errorStatus === 'ALREADY_USED' &&
                  'The recipient or someone with this link has already opened it. One-time links can only be accessed once and are instantly burned.'}
                {errorStatus === 'EXPIRED' &&
                  'The expiration timeframe configured for this link has elapsed. For security, expired links cannot be read.'}
                {errorStatus === 'NOT_FOUND' &&
                  'No active note was found matching this token. The link may have been deleted or the token is incorrect.'}
              </span>
            </div>
          </div>

          {onClearToken && (
            <button
              className="btn-secondary"
              onClick={() => {
                setErrorStatus(null);
                setErrorMessage(null);
                setTokenInput('');
                onClearToken();
              }}
            >
              Try Another Token <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
