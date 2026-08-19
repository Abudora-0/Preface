"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "./ui";

type Props = {
  children: ReactNode;
  /** Named in the fallback so the reader knows which part failed. */
  label: string;
  /**
   * Changing this remounts the boundary and clears the error. Pass whatever
   * the user can change to get out of the failure, such as the active tab.
   */
  resetKey?: string;
};

type State = { error: Error | null };

/**
 * Contains a render failure to one region of the builder.
 *
 * The route level error.tsx would replace the whole workspace, which throws
 * away the editor and preview along with whatever the user was looking at.
 * A panel that cannot render is not a reason to hide their draft, so each
 * region gets its own boundary and only that region is replaced.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Nothing is collected anywhere, so the console is the only record.
    console.error(
      `[${this.props.label}] render failed`,
      error,
      info.componentStack,
    );
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="p-4">
        <div className="rounded-md border border-[rgba(248,81,73,0.4)] bg-[rgba(248,81,73,0.1)] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose">
            <TriangleAlert size={15} />
            {this.props.label} could not be displayed
          </div>

          <p className="mb-1.5 text-[13px] leading-relaxed text-dim">
            Everything else still works, and your draft is untouched. Switching
            away and back is usually enough.
          </p>

          <p className="mb-3 font-mono text-[11px] break-words text-faint">
            {error.message || String(error)}
          </p>

          <Button size="sm" onClick={() => this.setState({ error: null })}>
            <RotateCcw size={13} />
            Try again
          </Button>
        </div>
      </div>
    );
  }
}
