/**
 * When a page fails to draw, the customer gets a calm page with a way on, never a blank screen. What
 * is saved in this browser is untouched. The error itself is recorded by its name only: no message
 * text, which could hold personal details.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { track } from "../../core/analytics";
import { reportError } from "../../core/monitoring";

interface Props {
  /** Where "Back to home" goes. */
  home: string;
  /** Changes on navigation, so moving to another page clears the error. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    track("page_failed", { kind: error?.name || "Error" });
    reportError(error, "page");
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-[100dvh] items-center bg-[var(--bg)] px-5 lg:px-10" role="alert">
        <div className="mx-auto flex max-w-[480px] flex-col gap-6">
          <h1 className="a-display">Something went wrong on my side.</h1>
          <p className="leading-6 text-[var(--muted)]">Your saved looks and your Style DNA are safe. Try this page again, or start from home.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="a-control a-primary" onClick={() => this.setState({ failed: false })}>
              Try again
            </button>
            <a className="a-control a-tertiary" href={this.props.home}>
              Back to home
            </a>
          </div>
        </div>
      </main>
    );
  }
}
