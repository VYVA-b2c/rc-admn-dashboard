import { Component, ErrorInfo, ReactNode } from "react";

type RouteErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
};

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[route-error]", {
      title: this.props.title || "This page could not load",
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    try {
      fetch("/api/v1/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: this.props.title || "This page could not load",
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        }),
      }).catch(() => {});
    } catch {}
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-foreground">
          {this.props.title || "This page could not load"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Something in this view failed to render. Refresh the page or return to the console while the issue is corrected.
        </p>
        <button
          className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          onClick={() => window.location.reload()}
          type="button"
        >
          Reload page
        </button>
      </div>
    );
  }
}
