import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("❌ [CRITICAL ERROR] App crashed:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Ops! Algo deu errado</h1>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Ocorreu um erro inesperado que impediu o carregamento da página. Mas não se preocupe, seus dados estão seguros.
            </p>
            
            <div className="space-y-3">
              <Button 
                onClick={this.handleReset}
                className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Recarregar Sistema
              </Button>
              <p className="text-xs text-slate-400 mt-4">
                Se o erro persistir, verifique sua conexão com a internet.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
