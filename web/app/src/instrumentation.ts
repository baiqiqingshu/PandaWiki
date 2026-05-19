// Sentry has been removed for intranet deployment.
// No server-side error reporting to external services.

export async function register() {
  // No-op: telemetry disabled for intranet deployment
}

export const onRequestError = undefined;
