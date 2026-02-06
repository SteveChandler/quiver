"use client";

import { Checkbox } from "@/components/ui/checkbox";

/**
 * Terms and Privacy consent checkbox
 */
export interface TermsCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function TermsCheckbox({ checked, onCheckedChange, disabled }: TermsCheckboxProps) {
  return (
    <div className="flex items-start space-x-2">
      <Checkbox
        id="terms-consent"
        checked={checked}
        onCheckedChange={(checked) => onCheckedChange(checked === true)}
        disabled={disabled}
        className="mt-1"
      />
      <label
        htmlFor="terms-consent"
        className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
      >
        I agree to the{" "}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Privacy Policy
        </a>
      </label>
    </div>
  );
}
