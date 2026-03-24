import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** Optional section name for context in error display */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic Error Boundary that catches rendering errors in child components
 * and displays a friendly fallback UI instead of crashing the entire app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Auto-reload on stale HMR/chunk errors (once only, prevent loop)
    if (error?.message?.includes('dynamically imported module') || error?.message?.includes('Failed to fetch')) {
      const key = 'error_boundary_reload';
      const lastReload = sessionStorage.getItem(key);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 30000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
        return;
      }
    }
    console.error(`[ErrorBoundary${this.props.section ? ` - ${this.props.section}` : ''}]`, error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[200px] text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              {this.props.section ? `Erro em ${this.props.section}` : 'Algo deu errado'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {this.state.error?.message || 'Um erro inesperado ocorreu nesta seção.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
