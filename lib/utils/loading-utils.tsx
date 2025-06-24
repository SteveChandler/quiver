import { Loader2 } from "lucide-react";

export const LoadingStates = {
  /**
   * Centered loading spinner for general use
   */
  center: (message?: string) => (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
      {message && (
        <span className="text-sm text-muted-foreground">{message}</span>
      )}
    </div>
  ),

  /**
   * Small spinner for buttons and inline use
   */
  spinner: () => <Loader2 className="h-4 w-4 animate-spin" />,

  /**
   * Full page loading screen
   */
  page: (message = "Loading...") => (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-sandy-beige via-white to-blue-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-ocean-blue" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Quiver</h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  ),

  /**
   * Community feed loading state
   */
  feed: (className = "") => (
    <div className={`py-8 ${className}`}>
      <div className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Loading feed...</span>
      </div>
    </div>
  ),
};

/**
 * Authentication specific loading states
 */
export const AuthLoadingStates = {
  signingIn: () => (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing In...
    </>
  ),

  redirecting: () => (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting...
    </>
  ),

  checking: () => LoadingStates.page("Checking authentication..."),
};
