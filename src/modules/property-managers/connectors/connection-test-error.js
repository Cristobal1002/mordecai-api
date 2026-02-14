/**
 * Maps raw errors from PMS API calls to user-friendly messages for connection test.
 * Used by connectors when testConnection() catches an error.
 */
export function getConnectionTestErrorMessage(err) {
  const status = err.response?.status;
  const bodyMessage =
    err.response?.data?.message ?? err.response?.data?.error ?? err.response?.data?.msg;
  const bodyStr = typeof bodyMessage === 'string' ? bodyMessage : null;

  if (status === 401 || status === 403) {
    return 'Invalid credentials. Please check your access key, secret, and account.';
  }
  if (status === 404) {
    return 'Account or endpoint not found. Check your account URL or identifier.';
  }
  if (status === 429) {
    return 'Too many requests. Please try again in a few minutes.';
  }
  if (bodyStr) return bodyStr;
  return err.message || 'Connection failed.';
}
