import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div className="app-layout app-layout--boot">
          <div className="app-boot-screen" style={{ maxWidth: '28rem' }}>
            <h1 className="title is-5 mb-3" style={{ color: '#f8fafc' }}>
              Algo falló al cargar la app
            </h1>
            <p className="mb-3" style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              {error?.message || 'Error inesperado. Probá recargar la página.'}
            </p>
            <button
              type="button"
              className="button is-link is-small"
              onClick={() => window.location.reload()}
            >
              Recargar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
