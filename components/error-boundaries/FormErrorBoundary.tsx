'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { ErrorFallback } from './ErrorFallback';
import {
  saveFormState,
  loadFormState,
  clearFormState,
} from './utils/state-persistence';

export interface FormErrorBoundaryProps {
  /**
   * Callback fired when form error occurs
   * Receives error and current form state
   */
  onFormError?: (error: Error, formState?: any) => void;

  /**
   * Whether to preserve form state on error
   * Default: true
   */
  preserveState?: boolean;

  /**
   * Form identifier for state storage
   */
  formId: string;

  /**
   * Child form components
   */
  children: ReactNode;

  /**
   * Whether to auto-save form state periodically
   * Default: true
   */
  autoSave?: boolean;

  /**
   * Auto-save interval (milliseconds)
   * Default: 30000 (30 seconds)
   */
  autoSaveInterval?: number;

  /**
   * Custom recovery UI
   */
  recoveryFallback?: (
    error: Error,
    savedState: any,
    restore: () => void
  ) => ReactNode;
}

interface FormErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  savedFormState: any;
  isRestored: boolean;
}

export class FormErrorBoundary extends Component<
  FormErrorBoundaryProps,
  FormErrorBoundaryState
> {
  private autoSaveIntervalId: NodeJS.Timeout | null = null;

  constructor(props: FormErrorBoundaryProps) {
    super(props);

    // Load any previously saved state
    const savedState = loadFormState(props.formId);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      savedFormState: savedState,
      isRestored: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<FormErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidMount() {
    // Start auto-save if enabled
    if (this.props.autoSave !== false) {
      this.startAutoSave();
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { formId, preserveState = true } = this.props;

    // Save current form state before error
    if (preserveState) {
      // Extract form data from DOM
      const formData = this.extractFormData();
      saveFormState(formId, formData);

      this.setState({ savedFormState: formData });
    }

    // Log to Sentry (lazy-loaded to defer ~555KB from initial bundle)
    const savedFormState = this.state.savedFormState;
    import('@sentry/nextjs').then(Sentry => {
      Sentry.withScope((scope) => {
        scope.setTag('error_boundary_type', 'form');
        scope.setTag('form_id', formId);
        scope.setTag('state_preserved', String(preserveState));

        scope.setContext('form_state', {
          has_saved_state: !!savedFormState,
          field_count: Object.keys(savedFormState || {}).length,
        });

        scope.setContext('component', {
          stack: errorInfo.componentStack,
        });

        Sentry.captureException(error);
      });
    }).catch(() => {});

    this.setState({ errorInfo });

    // Call custom error handler
    if (this.props.onFormError) {
      this.props.onFormError(error, this.state.savedFormState);
    }
  }

  componentWillUnmount() {
    // Clear auto-save interval
    if (this.autoSaveIntervalId) {
      clearInterval(this.autoSaveIntervalId);
    }
  }

  startAutoSave() {
    const { autoSaveInterval = 30000, formId } = this.props;

    this.autoSaveIntervalId = setInterval(() => {
      if (!this.state.hasError) {
        const formData = this.extractFormData();
        saveFormState(formId, formData);
      }
    }, autoSaveInterval);
  }

  extractFormData(): Record<string, any> {
    // Find all form elements and extract their values
    const formElements = document.querySelectorAll(
      `[data-form-id="${this.props.formId}"] input, ` +
      `[data-form-id="${this.props.formId}"] textarea, ` +
      `[data-form-id="${this.props.formId}"] select`
    );

    const formData: Record<string, any> = {};

    formElements.forEach((element) => {
      const input = element as HTMLInputElement;
      const name = input.name || input.id;

      if (name) {
        if (input.type === 'checkbox') {
          formData[name] = input.checked;
        } else if (input.type === 'radio') {
          if (input.checked) {
            formData[name] = input.value;
          }
        } else {
          formData[name] = input.value;
        }
      }
    });

    return formData;
  }

  restoreFormState = () => {
    const { savedFormState } = this.state;
    const { formId } = this.props;

    if (!savedFormState) return;

    // Restore form values
    Object.entries(savedFormState).forEach(([name, value]) => {
      const element = document.querySelector(
        `[data-form-id="${formId}"] [name="${name}"], ` +
        `[data-form-id="${formId}"] [id="${name}"]`
      ) as HTMLInputElement;

      if (element) {
        if (element.type === 'checkbox') {
          element.checked = value as boolean;
        } else if (element.type === 'radio') {
          element.checked = element.value === value;
        } else {
          element.value = value as string;
        }

        // Trigger change event
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    this.setState({ isRestored: true });
  };

  resetError = () => {
    const { formId } = this.props;

    // Clear saved state
    clearFormState(formId);

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      savedFormState: null,
      isRestored: false,
    });
  };

  render() {
    const {
      hasError,
      error,
      savedFormState,
      isRestored,
    } = this.state;
    const { children, recoveryFallback } = this.props;

    if (!hasError) {
      return children;
    }

    // Custom recovery fallback
    if (recoveryFallback && savedFormState) {
      return recoveryFallback(error!, savedFormState, this.restoreFormState);
    }

    // Default form error UI
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-red-900 mb-2">
            Form Error Occurred
          </h2>
          <p className="text-red-700 mb-4">
            An error occurred while processing your form, but your changes have
            been saved.
          </p>

          {savedFormState && (
            <div className="bg-white rounded-md p-4 mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Saved form data ({Object.keys(savedFormState).length} fields):
              </p>
              <div className="max-h-40 overflow-y-auto">
                <pre className="text-xs text-gray-700">
                  {JSON.stringify(savedFormState, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={this.restoreFormState}
              className="px-4 py-2 bg-ocean-blue text-white rounded-lg hover:bg-ocean-blue/90 transition-colors focus-ring"
              disabled={isRestored}
            >
              {isRestored ? 'Form Restored' : 'Restore Form'}
            </button>

            <button
              onClick={this.resetError}
              className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors focus-ring"
            >
              Start Over
            </button>
          </div>
        </div>

        {process.env.NODE_ENV === 'development' && error && (
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600">
              Technical Details
            </summary>
            <pre className="mt-2 p-4 bg-gray-100 rounded overflow-x-auto">
              {error.toString()}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
