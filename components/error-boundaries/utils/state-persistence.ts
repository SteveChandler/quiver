const STORAGE_PREFIX = 'quiver_form_state_';
const STORAGE_EXPIRY_MS = 1000 * 60 * 60 * 24; // 24 hours

interface StoredFormState {
  data: any;
  timestamp: number;
  formId: string;
}

/**
 * Save form state to localStorage
 */
export function saveFormState(formId: string, data: any): void {
  try {
    const state: StoredFormState = {
      data,
      timestamp: Date.now(),
      formId,
    };

    localStorage.setItem(
      `${STORAGE_PREFIX}${formId}`,
      JSON.stringify(state)
    );
  } catch (error) {
    console.error('Failed to save form state:', error);
  }
}

/**
 * Load form state from localStorage
 */
export function loadFormState(formId: string): any | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${formId}`);

    if (!stored) return null;

    const state: StoredFormState = JSON.parse(stored);

    // Check if expired
    const age = Date.now() - state.timestamp;
    if (age > STORAGE_EXPIRY_MS) {
      clearFormState(formId);
      return null;
    }

    return state.data;
  } catch (error) {
    console.error('Failed to load form state:', error);
    return null;
  }
}

/**
 * Clear form state from localStorage
 */
export function clearFormState(formId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${formId}`);
  } catch (error) {
    console.error('Failed to clear form state:', error);
  }
}

/**
 * Clear all expired form states
 */
export function clearExpiredFormStates(): void {
  try {
    const keys = Object.keys(localStorage);

    keys.forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const state: StoredFormState = JSON.parse(stored);
          const age = Date.now() - state.timestamp;

          if (age > STORAGE_EXPIRY_MS) {
            localStorage.removeItem(key);
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to clear expired form states:', error);
  }
}
