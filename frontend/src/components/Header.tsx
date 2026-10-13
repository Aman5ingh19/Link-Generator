import React, { useEffect, useState } from 'react';
import { Lock, Activity } from 'lucide-react';
import { fetchHealth, HealthInfo } from '../api/client';

export const Header: React.FC = () => {
  const [health, setHealth] = useState<HealthInfo | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const data = await fetchHealth();
        setHealth(data);
      } catch {
        setHealth({
          status: 'degraded',
          timestamp: new Date().toISOString(),
          uptimeSeconds: 0,
          database: 'disconnected',
          tracing: 'disabled',
        });
      }
    };

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-icon">
          <Lock size={24} />
        </div>
        <div>
          <h1 className="brand-title">One-Time Link Generator</h1>
          <p className="brand-subtitle">
            Secure self-destructing notes with Aiven MySQL &amp; Zipkin Distributed Tracing
          </p>
        </div>
      </div>

      <div className="health-badge" title="Backend health & database status">
        <Activity size={14} />
        <span
          className={`health-dot ${health?.status === 'healthy' ? 'healthy' : 'degraded'}`}
        />
        <span>
          {health ? (health.status === 'healthy' ? 'API & MySQL Online' : 'API Degraded') : 'Checking API...'}
        </span>
      </div>
    </header>
  );
};
