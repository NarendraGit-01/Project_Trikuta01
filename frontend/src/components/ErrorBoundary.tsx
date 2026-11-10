import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-4xl mx-auto my-12 p-6 bg-white border border-red-200 rounded-2xl shadow-lg">
          <div className="flex items-center space-x-3 text-red-600 mb-4">
            <AlertTriangle className="w-8 h-8" />
            <h2 className="text-lg font-bold">
              {this.props.fallbackTitle || 'A rendering error occurred in this view.'}
            </h2>
          </div>
          <p className="text-sm text-gray-700 mb-4">
            The page encountered an unexpected issue while rendering data:
          </p>
          <pre className="bg-red-50 text-red-800 p-3 rounded-lg text-xs font-mono mb-4 overflow-x-auto">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={this.handleReset}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-xl shadow"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Return to Scan</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
