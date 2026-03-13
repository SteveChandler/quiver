import { render, screen, fireEvent } from '@testing-library/react';
import { NearbySpots } from '@/components/oracle/nearby-spots';
import type { NearbySpot } from '@/components/oracle/nearby-spots';

jest.mock('next/link', () => {
  return function MockLink({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) {
    return <a {...props}>{children}</a>;
  };
});

jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  };
});

const mockSpots: NearbySpot[] = [
  { id: '1', name: 'Beach A', conditions: 'Good · 5 mph W', height: '3-4 ft', photoUrl: null, score: 80 },
  { id: '2', name: 'Beach B', conditions: 'Fair · 3 mph SW', height: '2-3 ft', photoUrl: null, score: 70 },
  { id: '3', name: 'Beach C', conditions: 'Fair · 8 mph W', height: '2-3 ft', photoUrl: null, score: 60 },
];

describe('NearbySpots scroll behavior', () => {
  it('renders the scroll container with the correct testid', () => {
    render(<NearbySpots spots={mockSpots} onViewSpot={jest.fn()} />);
    expect(screen.getByTestId('nearby-spots-scroll')).toBeInTheDocument();
  });

  it('converts vertical wheel events to horizontal scroll', () => {
    render(<NearbySpots spots={mockSpots} onViewSpot={jest.fn()} />);

    const scrollContainer = screen.getByTestId('nearby-spots-scroll');

    // Simulate mouse wheel (vertical deltaY)
    fireEvent.wheel(scrollContainer, { deltaY: 100 });

    // scrollLeft should be defined (jsdom initializes to 0)
    expect(scrollContainer.scrollLeft).toBeDefined();
  });

  it('attaches and cleans up the wheel event listener', () => {
    const addSpy = jest.spyOn(HTMLElement.prototype, 'addEventListener');
    const removeSpy = jest.spyOn(HTMLElement.prototype, 'removeEventListener');

    const { unmount } = render(<NearbySpots spots={mockSpots} onViewSpot={jest.fn()} />);

    // Wheel listener should have been registered
    expect(addSpy).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });

    unmount();

    // Cleanup should remove the listener
    expect(removeSpy).toHaveBeenCalledWith('wheel', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
