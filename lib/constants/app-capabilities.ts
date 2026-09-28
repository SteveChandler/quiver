/**
 * The app's selected-window sheet can create a watch (quiver-native plan:
 * "Watch on the selected-window sheet"). Until it ships and most active
 * installs have it, the web's signed-out Watch button says "Open in the app"
 * so it never promises what the app can't do. Flip in its own PR.
 */
export const NATIVE_SELECTED_WINDOW_WATCH = false;
