import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const root = ReactDOM.createRoot(document.getElementById("root"));

class ConvexErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <App convexEnabled={false} setupIssue="Convex is configured, but the current functions are not deployed yet." />;
    }

    return this.props.children;
  }
}

if (!convexUrl) {
  root.render(
    <React.StrictMode>
      <App convexEnabled={false} />
    </React.StrictMode>,
  );
} else {
  const convex = new ConvexReactClient(convexUrl);

  root.render(
    <React.StrictMode>
      <ConvexProvider client={convex}>
        <ConvexErrorBoundary>
          <App convexEnabled />
        </ConvexErrorBoundary>
      </ConvexProvider>
    </React.StrictMode>,
  );
}
