import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught runtime error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#09090b] text-white p-6 text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
          </div>
          <div className="space-y-2 max-w-md">
            <h1 className="text-2xl font-black tracking-tight text-zinc-100">
              Une erreur inattendue est survenue
            </h1>
            <p className="text-sm font-semibold text-zinc-400">
              L'affichage a rencontré un problème temporaire. Veuillez recharger la page.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <Button
              onClick={() => window.location.reload()}
              className="w-full rounded-xl h-12 font-black bg-primary text-white shadow-lg flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Recharger la page
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = "/dashboard";
              }}
              className="w-full rounded-xl h-12 font-bold border-zinc-800 text-zinc-300 hover:bg-zinc-900 flex items-center justify-center gap-2"
            >
              <Home className="h-4 w-4" />
              Tableau de bord
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
