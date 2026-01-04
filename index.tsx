
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Additional safety check for process.env
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || { env: {} };
}

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("React Render Error:", err);
    rootElement.innerHTML = `<div class="p-8 text-red-600">Failed to render app: ${String(err)}</div>`;
  }
} else {
  console.error("FATAL: Root element not found");
}
