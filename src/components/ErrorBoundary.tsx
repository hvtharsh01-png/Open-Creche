import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Keeps one broken widget (a map, a chart) from blanking the whole portal. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Portal error:', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-brand-100 bg-white p-8 text-center shadow-xl">
        <div className="text-lg font-extrabold text-ink">Something went wrong on this page</div>
        <p className="mt-2 text-sm text-muted">The rest of the portal still works. Try going back or reloading.</p>
        <button onClick={() => this.setState({ error: null })} className="mt-4 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-bold text-white">
          Try again
        </button>
      </div>
    );
  }
}
