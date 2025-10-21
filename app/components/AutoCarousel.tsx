'use client';

import { useEffect, useState } from 'react';

type AutoCarouselProps = {
  urls: string[];
  intervalMs?: number;
  borderClass?: string;
};

export default function AutoCarousel({
  urls,
  intervalMs = 4000,
  borderClass = 'ring-2 ring-sky-600',
}: AutoCarouselProps) {
  const [index, setIndex] = useState(0);
  const total = urls.length;

  useEffect(() => {
    if (!total) return;
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, total]);

  if (!total) return null;

  return (
    <div className={`relative aspect-[16/9] overflow-hidden rounded-2xl ${borderClass}`}>
      {urls.map((url, idx) => (
        <img
          key={url}
          src={url}
          alt="beach photo"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            idx === index ? 'opacity-100' : 'opacity-0'
          }`}
          loading={idx === 0 ? 'eager' : 'lazy'}
        />
      ))}
    </div>
  );
}
