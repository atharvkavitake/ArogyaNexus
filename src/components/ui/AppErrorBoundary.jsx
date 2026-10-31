import React from 'react';
import { Link } from 'react-router-dom';

export default class AppErrorBoundary extends React.Component {
  state = { failed: false, error: null };
  static getDerivedStateFromError(error) { return { failed: true, error }; }
  componentDidCatch(error, errorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-error-page">
        <span aria-hidden="true">!</span>
        <p>AROGYANEXUS</p>
        <h1>We hit an unexpected error</h1>
        <p>Your health information is still safe. Reload the page or return to the dashboard.</p>
        {this.state.error && (
          <div style={{ maxWidth: '680px', margin: '15px auto', padding: '12px 16px', background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', borderRadius: '8px', fontSize: '13px', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
            <strong>{this.state.error.name}: {this.state.error.message}</strong>
            {this.state.error.stack && (
              <pre style={{ margin: '8px 0 0', fontSize: '11px', maxHeight: '180px', overflow: 'auto' }}>
                {this.state.error.stack}
              </pre>
            )}
          </div>
        )}
        <div>
          <button type="button" onClick={() => window.location.reload()}>Reload page</button>
          <Link to="/">Go to home</Link>
        </div>
      </main>
    );
  }
}
