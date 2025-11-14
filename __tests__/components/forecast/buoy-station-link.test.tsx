import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BuoyStationLink } from '@/components/forecast/buoy-station-link';

describe('BuoyStationLink', () => {
  const mockProps = {
    stationId: '220',
    stationName: 'Scripps Pier',
    distance: 2.3,
    beachLocation: {
      latitude: 32.8674,
      longitude: -117.2548,
    },
  };

  describe('Default Variant', () => {
    it('renders station ID and name correctly', () => {
      render(<BuoyStationLink stationId="220" stationName="Scripps Pier" />);

      expect(screen.getByText(/CDIP 220 - Scripps Pier/)).toBeInTheDocument();
    });

    it('displays distance when provided', () => {
      render(<BuoyStationLink {...mockProps} />);

      expect(screen.getByText(/2.3 km away/)).toBeInTheDocument();
    });

    it('links to correct buoy page URL', () => {
      render(<BuoyStationLink {...mockProps} />);

      const link = screen.getByTestId('buoy-link-220');
      expect(link).toHaveAttribute('href', '/buoys/220');
    });

    it('displays MapPin icon', () => {
      const { container } = render(<BuoyStationLink {...mockProps} />);

      const link = screen.getByTestId('buoy-link-220');
      const svg = link.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('shows external link icon on hover by default', () => {
      const { container } = render(<BuoyStationLink {...mockProps} />);

      const link = screen.getByTestId('buoy-link-220');
      // Check that ExternalLink icon exists (will have opacity-0 initially)
      const icons = link.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(1); // MapPin + ExternalLink
    });

    it('hides external link icon when showIcon is false', () => {
      const { container } = render(
        <BuoyStationLink {...mockProps} showIcon={false} />
      );

      const link = screen.getByTestId('buoy-link-220');
      const icons = link.querySelectorAll('svg');
      expect(icons.length).toBe(1); // Only MapPin icon
    });
  });

  describe('Compact Variant', () => {
    it('renders in compact style', () => {
      render(<BuoyStationLink {...mockProps} variant="compact" />);

      const link = screen.getByTestId('buoy-link-220');
      expect(link).toHaveClass('text-xs');
      expect(screen.getByText('CDIP 220')).toBeInTheDocument();
    });

    it('displays distance in compact format', () => {
      render(<BuoyStationLink {...mockProps} variant="compact" />);

      expect(screen.getByText(/\(2.3 km\)/)).toBeInTheDocument();
    });

    it('links to correct URL in compact mode', () => {
      render(<BuoyStationLink {...mockProps} variant="compact" />);

      const link = screen.getByTestId('buoy-link-220');
      expect(link).toHaveAttribute('href', '/buoys/220');
    });
  });

  describe('Inline Variant', () => {
    it('renders in inline style', () => {
      render(<BuoyStationLink {...mockProps} variant="inline" />);

      const link = screen.getByTestId('buoy-link-220');
      expect(link).toHaveClass('text-sm');
      expect(screen.getByText(/CDIP 220 - Scripps Pier/)).toBeInTheDocument();
    });

    it('includes distance in full text', () => {
      render(<BuoyStationLink {...mockProps} variant="inline" />);

      expect(screen.getByText(/\(2.3 km\)/)).toBeInTheDocument();
    });

    it('shows external link icon when showIcon is true', () => {
      const { container } = render(
        <BuoyStationLink {...mockProps} variant="inline" showIcon={true} />
      );

      const link = screen.getByTestId('buoy-link-220');
      const icons = link.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Distance Formatting', () => {
    it('formats distance in kilometers with one decimal place', () => {
      render(<BuoyStationLink {...mockProps} distance={5.67} />);

      expect(screen.getByText(/5.7 km/)).toBeInTheDocument();
    });

    it('formats distances under 1 km in meters', () => {
      render(<BuoyStationLink {...mockProps} distance={0.5} />);

      expect(screen.getByText(/500m/)).toBeInTheDocument();
    });

    it('rounds meters to whole numbers', () => {
      render(<BuoyStationLink {...mockProps} distance={0.345} />);

      expect(screen.getByText(/345m/)).toBeInTheDocument();
    });

    it('does not display distance when not provided', () => {
      render(
        <BuoyStationLink
          stationId="220"
          stationName="Scripps Pier"
          variant="default"
        />
      );

      expect(screen.queryByText(/km/)).not.toBeInTheDocument();
      expect(screen.queryByText(/away/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('includes descriptive aria-label with all information', () => {
      render(<BuoyStationLink {...mockProps} />);

      const link = screen.getByTestId('buoy-link-220');
      expect(link).toHaveAttribute(
        'aria-label',
        'View buoy station 220 - Scripps Pier, 2.3 km away'
      );
    });

    it('includes aria-label without distance when not provided', () => {
      render(
        <BuoyStationLink stationId="220" stationName="Scripps Pier" />
      );

      const link = screen.getByTestId('buoy-link-220');
      expect(link).toHaveAttribute(
        'aria-label',
        'View buoy station 220 - Scripps Pier'
      );
    });

    it('is keyboard accessible as a link', () => {
      render(<BuoyStationLink {...mockProps} />);

      const link = screen.getByTestId('buoy-link-220');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href');
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      render(
        <BuoyStationLink {...mockProps} className="custom-test-class" />
      );

      const link = screen.getByTestId('buoy-link-220');
      expect(link).toHaveClass('custom-test-class');
    });

    it('merges custom className with default styling', () => {
      render(<BuoyStationLink {...mockProps} className="mt-4" />);

      const link = screen.getByTestId('buoy-link-220');
      expect(link).toHaveClass('mt-4', 'inline-flex', 'items-center');
    });
  });

  describe('Beach Location Props', () => {
    it('accepts beach location coordinates', () => {
      const beachLocation = {
        latitude: 33.1234,
        longitude: -118.5678,
      };

      render(
        <BuoyStationLink
          stationId="191"
          stationName="Santa Monica Basin"
          beachLocation={beachLocation}
        />
      );

      const link = screen.getByTestId('buoy-link-191');
      expect(link).toBeInTheDocument();
    });

    it('works without beach location', () => {
      render(
        <BuoyStationLink stationId="220" stationName="Scripps Pier" />
      );

      const link = screen.getByTestId('buoy-link-220');
      expect(link).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles station ID with leading zeros', () => {
      render(
        <BuoyStationLink stationId="028" stationName="Cape San Martin" />
      );

      expect(screen.getByText(/CDIP 028/)).toBeInTheDocument();
      expect(screen.getByTestId('buoy-link-028')).toBeInTheDocument();
    });

    it('handles very long station names', () => {
      const longName =
        'Very Long Station Name That Should Still Display Properly';
      render(<BuoyStationLink stationId="220" stationName={longName} />);

      expect(screen.getByText(new RegExp(longName))).toBeInTheDocument();
    });

    it('handles zero distance', () => {
      render(<BuoyStationLink {...mockProps} distance={0} />);

      expect(screen.getByText(/0m/)).toBeInTheDocument();
    });

    it('handles very small distances', () => {
      render(<BuoyStationLink {...mockProps} distance={0.001} />);

      expect(screen.getByText(/1m/)).toBeInTheDocument();
    });

    it('handles very large distances', () => {
      render(<BuoyStationLink {...mockProps} distance={150.789} />);

      expect(screen.getByText(/150.8 km/)).toBeInTheDocument();
    });

    it('handles special characters in station name', () => {
      render(
        <BuoyStationLink
          stationId="220"
          stationName="Station (Test) - Name & More"
        />
      );

      expect(
        screen.getByText(/Station \(Test\) - Name & More/)
      ).toBeInTheDocument();
    });
  });

  describe('Visual Styling', () => {
    it('applies blue theme colors for default variant', () => {
      render(<BuoyStationLink {...mockProps} />);

      const link = screen.getByTestId('buoy-link-220');
      expect(link).toHaveClass('border-blue-200', 'bg-blue-50');
    });

    it('has hover state classes', () => {
      render(<BuoyStationLink {...mockProps} />);

      const link = screen.getByTestId('buoy-link-220');
      expect(link).toHaveClass('hover:bg-blue-100', 'hover:border-blue-300');
    });

    it('has transition classes for smooth animations', () => {
      render(<BuoyStationLink {...mockProps} />);

      const link = screen.getByTestId('buoy-link-220');
      expect(link).toHaveClass('transition-colors');
    });
  });

  describe('Data Test IDs', () => {
    it('generates correct test ID from station ID', () => {
      render(<BuoyStationLink stationId="191" stationName="Test Station" />);

      expect(screen.getByTestId('buoy-link-191')).toBeInTheDocument();
    });

    it('maintains consistent test ID across variants', () => {
      const { rerender } = render(
        <BuoyStationLink {...mockProps} variant="default" />
      );
      expect(screen.getByTestId('buoy-link-220')).toBeInTheDocument();

      rerender(<BuoyStationLink {...mockProps} variant="compact" />);
      expect(screen.getByTestId('buoy-link-220')).toBeInTheDocument();

      rerender(<BuoyStationLink {...mockProps} variant="inline" />);
      expect(screen.getByTestId('buoy-link-220')).toBeInTheDocument();
    });
  });
});
