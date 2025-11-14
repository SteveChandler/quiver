import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WindDirectionCompass } from '@/components/profile/wind-direction-compass';

describe('WindDirectionCompass', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all 8 cardinal directions', () => {
      render(<WindDirectionCompass value={[]} onChange={mockOnChange} />);

      expect(screen.getByLabelText(/North \(0°\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Northeast \(45°\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/East \(90°\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Southeast \(135°\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/South \(180°\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Southwest \(225°\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/West \(270°\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Northwest \(315°\)/i)).toBeInTheDocument();
    });

    it('should render compass icon in center', () => {
      render(<WindDirectionCompass value={[]} onChange={mockOnChange} />);
      const icon = screen.getByLabelText(/North \(0°\)/i).closest('div')?.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <WindDirectionCompass value={[]} onChange={mockOnChange} className="custom-class" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('Selection State', () => {
    it('should mark selected directions with aria-pressed', () => {
      render(<WindDirectionCompass value={[0, 90]} onChange={mockOnChange} />);

      const northButton = screen.getByLabelText(/North \(0°\)/i);
      const eastButton = screen.getByLabelText(/East \(90°\)/i);
      const southButton = screen.getByLabelText(/South \(180°\)/i);

      expect(northButton).toHaveAttribute('aria-pressed', 'true');
      expect(eastButton).toHaveAttribute('aria-pressed', 'true');
      expect(southButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should apply selected styling to selected directions', () => {
      render(<WindDirectionCompass value={[0, 90]} onChange={mockOnChange} />);

      const northButton = screen.getByLabelText(/North \(0°\)/i);
      const eastButton = screen.getByLabelText(/East \(90°\)/i);

      expect(northButton).toHaveClass('border-ocean-blue', 'bg-ocean-blue', 'text-white');
      expect(eastButton).toHaveClass('border-ocean-blue', 'bg-ocean-blue', 'text-white');
    });

    it('should apply unselected styling to unselected directions', () => {
      render(<WindDirectionCompass value={[0]} onChange={mockOnChange} />);

      const southButton = screen.getByLabelText(/South \(180°\)/i);

      expect(southButton).toHaveClass('border-gray-300', 'bg-white', 'text-gray-700');
    });

    it('should display selected directions text when selections exist', () => {
      render(<WindDirectionCompass value={[0, 90, 180]} onChange={mockOnChange} />);

      expect(screen.getByText(/Selected: N, E, S/i)).toBeInTheDocument();
    });

    it('should not display selected directions text when no selections', () => {
      render(<WindDirectionCompass value={[]} onChange={mockOnChange} />);

      expect(screen.queryByText(/Selected:/i)).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onChange with added direction when clicking unselected', () => {
      render(<WindDirectionCompass value={[]} onChange={mockOnChange} />);

      const northButton = screen.getByLabelText(/North \(0°\)/i);
      fireEvent.click(northButton);

      expect(mockOnChange).toHaveBeenCalledWith([0]);
    });

    it('should call onChange with removed direction when clicking selected', () => {
      render(<WindDirectionCompass value={[0, 90, 180]} onChange={mockOnChange} />);

      const eastButton = screen.getByLabelText(/East \(90°\)/i);
      fireEvent.click(eastButton);

      expect(mockOnChange).toHaveBeenCalledWith([0, 180]);
    });

    it('should handle multiple selections', () => {
      const { rerender } = render(<WindDirectionCompass value={[]} onChange={mockOnChange} />);

      // First click
      fireEvent.click(screen.getByLabelText(/North \(0°\)/i));
      expect(mockOnChange).toHaveBeenCalledWith([0]);

      // Update value and click another
      rerender(<WindDirectionCompass value={[0]} onChange={mockOnChange} />);
      fireEvent.click(screen.getByLabelText(/East \(90°\)/i));
      expect(mockOnChange).toHaveBeenCalledWith([0, 90]);
    });

    it('should maintain sorted order of degrees', () => {
      render(<WindDirectionCompass value={[180]} onChange={mockOnChange} />);

      // Click 0° (should be inserted before 180°)
      fireEvent.click(screen.getByLabelText(/North \(0°\)/i));

      expect(mockOnChange).toHaveBeenCalledWith([0, 180]);
    });

    it('should handle selecting all directions', () => {
      const { rerender } = render(<WindDirectionCompass value={[]} onChange={mockOnChange} />);

      const directions = [0, 45, 90, 135, 180, 225, 270, 315];
      let current: number[] = [];

      directions.forEach((deg, index) => {
        const label = {
          0: 'North (0°)',
          45: 'Northeast (45°)',
          90: 'East (90°)',
          135: 'Southeast (135°)',
          180: 'South (180°)',
          225: 'Southwest (225°)',
          270: 'West (270°)',
          315: 'Northwest (315°)',
        }[deg];

        fireEvent.click(screen.getByLabelText(label!));
        current = [...current, deg].sort((a, b) => a - b);

        expect(mockOnChange).toHaveBeenNthCalledWith(index + 1, current);
        rerender(<WindDirectionCompass value={current} onChange={mockOnChange} />);
      });

      // All should be selected
      expect(screen.getByText(/Selected: N, NE, E, SE, S, SW, W, NW/i)).toBeInTheDocument();
    });

    it('should deselect all when clicking each selected direction', () => {
      const allDirections = [0, 45, 90, 135, 180, 225, 270, 315];
      const { rerender } = render(
        <WindDirectionCompass value={allDirections} onChange={mockOnChange} />
      );

      let current = [...allDirections];

      allDirections.forEach((deg, index) => {
        const label = {
          0: 'North (0°)',
          45: 'Northeast (45°)',
          90: 'East (90°)',
          135: 'Southeast (135°)',
          180: 'South (180°)',
          225: 'Southwest (225°)',
          270: 'West (270°)',
          315: 'Northwest (315°)',
        }[deg];

        fireEvent.click(screen.getByLabelText(label!));
        current = current.filter((d) => d !== deg);

        expect(mockOnChange).toHaveBeenNthCalledWith(index + 1, current);
        rerender(<WindDirectionCompass value={current} onChange={mockOnChange} />);
      });

      // None selected
      expect(screen.queryByText(/Selected:/i)).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should apply disabled attribute to all buttons when disabled', () => {
      render(<WindDirectionCompass value={[]} onChange={mockOnChange} disabled />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it('should apply disabled styling when disabled', () => {
      render(<WindDirectionCompass value={[0]} onChange={mockOnChange} disabled />);

      const northButton = screen.getByLabelText(/North \(0°\)/i);
      expect(northButton).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('should not call onChange when clicking disabled button', () => {
      render(<WindDirectionCompass value={[]} onChange={mockOnChange} disabled />);

      const northButton = screen.getByLabelText(/North \(0°\)/i);
      fireEvent.click(northButton);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for all directions', () => {
      render(<WindDirectionCompass value={[]} onChange={mockOnChange} />);

      expect(screen.getByLabelText('North (0°)')).toBeInTheDocument();
      expect(screen.getByLabelText('Northeast (45°)')).toBeInTheDocument();
      expect(screen.getByLabelText('East (90°)')).toBeInTheDocument();
      expect(screen.getByLabelText('Southeast (135°)')).toBeInTheDocument();
      expect(screen.getByLabelText('South (180°)')).toBeInTheDocument();
      expect(screen.getByLabelText('Southwest (225°)')).toBeInTheDocument();
      expect(screen.getByLabelText('West (270°)')).toBeInTheDocument();
      expect(screen.getByLabelText('Northwest (315°)')).toBeInTheDocument();
    });

    it('should have aria-live region for selected directions', () => {
      render(<WindDirectionCompass value={[0, 90]} onChange={mockOnChange} />);

      const selectedDisplay = screen.getByText(/Selected: N, E/i);
      expect(selectedDisplay).toHaveAttribute('aria-live', 'polite');
    });

    it('should have proper focus styles', () => {
      render(<WindDirectionCompass value={[]} onChange={mockOnChange} />);

      const northButton = screen.getByLabelText(/North \(0°\)/i);
      expect(northButton).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-ocean-blue');
    });

    it('should use button type to prevent form submission', () => {
      render(<WindDirectionCompass value={[]} onChange={mockOnChange} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty value array', () => {
      render(<WindDirectionCompass value={[]} onChange={mockOnChange} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-pressed', 'false');
      });
    });

    it('should handle undefined value gracefully', () => {
      // @ts-expect-error - Testing undefined edge case
      render(<WindDirectionCompass value={undefined} onChange={mockOnChange} />);

      const northButton = screen.getByLabelText(/North \(0°\)/i);
      fireEvent.click(northButton);

      // Should treat as empty array
      expect(mockOnChange).toHaveBeenCalledWith([0]);
    });

    it('should handle duplicate degrees in value array', () => {
      render(<WindDirectionCompass value={[0, 0, 90]} onChange={mockOnChange} />);

      const northButton = screen.getByLabelText(/North \(0°\)/i);
      expect(northButton).toHaveAttribute('aria-pressed', 'true');

      // Click to deselect
      fireEvent.click(northButton);

      // Should only remove once (both duplicates)
      expect(mockOnChange).toHaveBeenCalledWith([90]);
    });

    it('should handle unsorted value array', () => {
      render(<WindDirectionCompass value={[180, 0, 90]} onChange={mockOnChange} />);

      const eastButton = screen.getByLabelText('East (90°)');
      fireEvent.click(eastButton);

      // Should maintain sorted order
      expect(mockOnChange).toHaveBeenCalledWith([0, 180]);
    });
  });
});
