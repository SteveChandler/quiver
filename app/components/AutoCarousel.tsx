'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

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
    <div
      className={`relative aspect-[16/9] overflow-hidden rounded-2xl ${borderClass}`}
    >
      {urls.map((url, idx) => (
        <div
          key={url}
          className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
            idx === index ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={url}
            alt="Surf session"
            fill
            priority={idx === 0}
            quality={85}
            className="object-cover"
            sizes="100vw"
            loading={idx === 0 ? undefined : 'eager'}
          />
        </div>
      ))}
    </div>
  );
}
