import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
  logPath: string
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, logPath: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  async componentDidCatch(error: Error, info: ErrorInfo) {
    const msg = `${error.message}\n${info.componentStack}`
    window.api?.log?.error(msg)
    try {
      const logPath = await window.api?.log?.getLogPath?.()
      this.setState({ logPath: logPath ?? '' })
    } catch {
      // ignore
    }
  }

  render() {
    const { error, logPath } = this.state
    if (!error) return this.props.children

    return (
      <div style={{ padding: 32, fontFamily: 'monospace', background: '#1a1a2e', color: '#e0e0e0', minHeight: '100vh' }}>
        <h1 style={{ color: '#ff6b6b', fontSize: 20, marginBottom: 16 }}>
          Something went wrong
        </h1>
        <pre style={{ background: '#16213e', padding: 16, borderRadius: 8, overflowX: 'auto', fontSize: 13, color: '#ffd166', whiteSpace: 'pre-wrap' }}>
          {error.stack ?? error.message}
        </pre>
        {logPath && (
          <p style={{ marginTop: 16, fontSize: 13, color: '#aaa' }}>
            Full log: <strong style={{ color: '#fff' }}>{logPath}</strong>
          </p>
        )}
        <p style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
          Share the log file or the error above to get help.
        </p>
        <button
          onClick={() => this.setState({ error: null })}
          style={{ marginTop: 16, padding: '8px 16px', background: '#e94560', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    )
  }
}
