import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ForecastConfidenceBadge } from '@/components/forecast/forecast-confidence-badge';

describe('ForecastConfidenceBadge', () => {
  describe('Confidence Level Classification', () => {
    it('renders high confidence badge for confidence >= 75%', () => {
      render(<ForecastConfidenceBadge confidence={75} />);

      const badge = screen.getByTestId('confidence-badge-high');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('High Confidence');
      expect(badge).toHaveTextContent('(75%)');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200');
    });

    it('renders high confidence badge for confidence at 100%', () => {
      render(<ForecastConfidenceBadge confidence={100} />);

      const badge = screen.getByTestId('confidence-badge-high');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('High Confidence');
      expect(badge).toHaveTextContent('(100%)');
    });

    it('renders medium confidence badge for confidence between 50-74%', () => {
      render(<ForecastConfidenceBadge confidence={50} />);

      const badge = screen.getByTestId('confidence-badge-medium');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Medium Confidence');
      expect(badge).toHaveTextContent('(50%)');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800', 'border-yellow-200');
    });

    it('renders medium confidence badge at upper boundary (74%)', () => {
      render(<ForecastConfidenceBadge confidence={74} />);

      const badge = screen.getByTestId('confidence-badge-medium');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('(74%)');
    });

    it('renders low confidence badge for confidence < 50%', () => {
      render(<ForecastConfidenceBadge confidence={49} />);

      const badge = screen.getByTestId('confidence-badge-low');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Low Confidence');
      expect(badge).toHaveTextContent('(49%)');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-200');
    });

    it('renders low confidence badge for confidence at 0%', () => {
      render(<ForecastConfidenceBadge confidence={0} />);

      const badge = screen.getByTestId('confidence-badge-low');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('(0%)');
    });
  });

  describe('Percentage Display', () => {
    it('shows percentage by default', () => {
      render(<ForecastConfidenceBadge confidence={85} />);

      expect(screen.getByText(/\(85%\)/)).toBeInTheDocument();
    });

    it('hides percentage when showPercentage is false', () => {
      render(<ForecastConfidenceBadge confidence={85} showPercentage={false} />);

      const badge = screen.getByTestId('confidence-badge-high');
      expect(badge).toHaveTextContent('High Confidence');
      expect(badge).not.toHaveTextContent('(85%)');
      expect(badge).not.toHaveTextContent('%');
    });

    it('shows percentage when showPercentage is true', () => {
      render(<ForecastConfidenceBadge confidence={65} showPercentage={true} />);

      expect(screen.getByText(/\(65%\)/)).toBeInTheDocument();
    });
  });

  describe('Icons', () => {
    it('displays CheckCircle icon for high confidence', () => {
      const { container } = render(<ForecastConfidenceBadge confidence={80} />);

      // CheckCircle icon should be present (lucide-react renders SVG)
      const badge = screen.getByTestId('confidence-badge-high');
      const svg = badge.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-3', 'h-3', 'mr-1');
    });

    it('displays AlertCircle icon for medium confidence', () => {
      const { container } = render(<ForecastConfidenceBadge confidence={60} />);

      const badge = screen.getByTestId('confidence-badge-medium');
      const svg = badge.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-3', 'h-3', 'mr-1');
    });

    it('displays HelpCircle icon for low confidence', () => {
      const { container } = render(<ForecastConfidenceBadge confidence={30} />);

      const badge = screen.getByTestId('confidence-badge-low');
      const svg = badge.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-3', 'h-3', 'mr-1');
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      render(<ForecastConfidenceBadge confidence={75} className="custom-class" />);

      const badge = screen.getByTestId('confidence-badge-high');
      expect(badge).toHaveClass('custom-class');
    });

    it('merges custom className with default styling', () => {
      render(<ForecastConfidenceBadge confidence={75} className="ml-4" />);

      const badge = screen.getByTestId('confidence-badge-high');
      expect(badge).toHaveClass('ml-4', 'bg-green-100', 'text-green-800', 'border-green-200');
    });
  });

  describe('Edge Cases', () => {
    it('handles negative confidence values (treats as low confidence)', () => {
      render(<ForecastConfidenceBadge confidence={-10} />);

      const badge = screen.getByTestId('confidence-badge-low');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('(-10%)');
    });

    it('handles confidence values over 100 (treats as high confidence)', () => {
      render(<ForecastConfidenceBadge confidence={150} />);

      const badge = screen.getByTestId('confidence-badge-high');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('(150%)');
    });

    it('handles decimal confidence values', () => {
      render(<ForecastConfidenceBadge confidence={67.5} />);

      const badge = screen.getByTestId('confidence-badge-medium');
      expect(badge).toHaveTextContent('(67.5%)');
    });

    it('renders correctly with confidence at exact threshold boundaries', () => {
      // Test boundary at 50% (medium/low threshold)
      const { rerender } = render(<ForecastConfidenceBadge confidence={49.9} />);
      expect(screen.getByTestId('confidence-badge-low')).toBeInTheDocument();

      rerender(<ForecastConfidenceBadge confidence={50} />);
      expect(screen.getByTestId('confidence-badge-medium')).toBeInTheDocument();

      // Test boundary at 75% (high/medium threshold)
      rerender(<ForecastConfidenceBadge confidence={74.9} />);
      expect(screen.getByTestId('confidence-badge-medium')).toBeInTheDocument();

      rerender(<ForecastConfidenceBadge confidence={75} />);
      expect(screen.getByTestId('confidence-badge-high')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses Badge component with proper variant', () => {
      const { container } = render(<ForecastConfidenceBadge confidence={75} />);

      const badge = screen.getByTestId('confidence-badge-high');
      expect(badge).toHaveAttribute('data-testid', 'confidence-badge-high');
    });

    it('provides visual indicators through color and icon', () => {
      const { rerender } = render(<ForecastConfidenceBadge confidence={80} />);
      let badge = screen.getByTestId('confidence-badge-high');
      expect(badge).toHaveClass('bg-green-100');

      rerender(<ForecastConfidenceBadge confidence={60} />);
      badge = screen.getByTestId('confidence-badge-medium');
      expect(badge).toHaveClass('bg-yellow-100');

      rerender(<ForecastConfidenceBadge confidence={30} />);
      badge = screen.getByTestId('confidence-badge-low');
      expect(badge).toHaveClass('bg-gray-100');
    });

    it('provides clear text labels for screen readers', () => {
      const { rerender } = render(<ForecastConfidenceBadge confidence={80} />);
      expect(screen.getByText(/High Confidence/)).toBeInTheDocument();

      rerender(<ForecastConfidenceBadge confidence={60} />);
      expect(screen.getByText(/Medium Confidence/)).toBeInTheDocument();

      rerender(<ForecastConfidenceBadge confidence={30} />);
      expect(screen.getByText(/Low Confidence/)).toBeInTheDocument();
    });
  });
});
