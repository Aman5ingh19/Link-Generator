import React, { useState, useEffect } from 'react';
import { PlusCircle, LayoutDashboard, Eye } from 'lucide-react';
import { Header } from './components/Header';
import { CreateLinkTab } from './components/CreateLinkTab';
import { DashboardTab } from './components/DashboardTab';
import { ConsumeTab } from './components/ConsumeTab';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'dashboard' | 'consume'>('create');
  const [selectedToken, setSelectedToken] = useState<string>('');

  useEffect(() => {
    // Check if URL has ?token=... or #/link/:token
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setSelectedToken(tokenParam);
      setActiveTab('consume');
    }
  }, []);

  const handleOpenConsume = (token: string) => {
    setSelectedToken(token);
    setActiveTab('consume');
    // Update URL query without full reload
    const url = new URL(window.location.href);
    url.searchParams.set('token', token);
    window.history.pushState({}, '', url.toString());
  };

  const handleClearToken = () => {
    setSelectedToken('');
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.pushState({}, '', url.toString());
  };

  return (
    <div className="container">
      <Header />

      {/* Navigation Tabs */}
      <nav className="tabs-nav" aria-label="Main Navigation">
        <button
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          <PlusCircle size={16} />
          Generate Link
        </button>

        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={16} />
          Dashboard
        </button>

        <button
          className={`tab-btn ${activeTab === 'consume' ? 'active' : ''}`}
          onClick={() => setActiveTab('consume')}
        >
          <Eye size={16} />
          Open &amp; Consume Link
        </button>
      </nav>

      {/* Main Tab Content */}
      <main>
        {activeTab === 'create' && (
          <CreateLinkTab
            onOpenConsume={handleOpenConsume}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardTab
            onOpenConsume={handleOpenConsume}
          />
        )}

        {activeTab === 'consume' && (
          <ConsumeTab
            initialToken={selectedToken}
            onClearToken={handleClearToken}
          />
        )}
      </main>

      {/* Tech Stack Pills for Learning */}
      <footer className="tech-bar">
        <span className="tech-tag">React 18 + Vite</span>
        <span className="tech-tag">TypeScript</span>
        <span className="tech-tag">Express.js REST API</span>
        <span className="tech-tag">Prisma ORM</span>
        <span className="tech-tag">Aiven Cloud MySQL</span>
        <span className="tech-tag">Zipkin Distributed Tracing</span>
        <span className="tech-tag">Docker Compose</span>
        <span className="tech-tag">Jenkins CI</span>
        <span className="tech-tag">Ansible Automation</span>
      </footer>
    </div>
  );
};

export default App;
