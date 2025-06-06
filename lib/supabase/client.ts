import { getClientBrowserClient } from "../supabase";

// Export a createClient function that returns the browser client
export const createClient = () => {
  return getClientBrowserClient();
};
