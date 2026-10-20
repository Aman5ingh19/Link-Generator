// IMPORTANT: Tracing must be imported FIRST — before React, App, or any
// module that calls fetch(). OpenTelemetry patches window.fetch on import.
import './tracing';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
