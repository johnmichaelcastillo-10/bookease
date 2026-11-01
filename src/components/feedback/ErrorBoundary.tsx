import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './states'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/** Catches render errors in a subtree so one broken widget doesn't blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('BookEase render error', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        this.props.fallback?.(this.state.error, this.reset) ?? (
          <ErrorState description="This section failed to render. Your data is safe in this browser." onRetry={this.reset} />
        )
      )
    }
    return this.props.children
  }
}
