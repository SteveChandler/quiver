"use client";

import Link from "next/link";
import Image from "next/image";
import { SectionWrapper } from "./section-wrapper";
import { CONTENT, SURF_ACTIVITIES } from "@/lib/constants/features";

export function ActivitiesSection() {
  return (
    <SectionWrapper
      title={CONTENT.sections.activities.title}
      subtitle={CONTENT.sections.activities.subtitle}
      className="py-16 md:py-20 px-4 bg-[#252D6B]"
      titleClassName="text-2xl sm:text-3xl font-heading font-semibold text-white"
    >
      {/* Desktop / Tablet: evenly spread across full width */}
      <ul className="mt-10 hidden w-full items-start justify-between md:flex">
        {SURF_ACTIVITIES.map((activity) => (
          <li
            key={activity.title}
            className="flex flex-col items-center text-center"
          >
            <Link
              href={activity.link}
              className="group flex flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B] rounded-2xl"
            >
              <span className="relative flex h-24 w-24 shrink-0 items-center justify-center md:h-28 md:w-28 lg:h-32 lg:w-32 rounded-full overflow-hidden shadow-lg shadow-black/20 ring-1 ring-white/10 transition-all group-hover:ring-ocean-blue/40 group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(74,112,217,0.15)]">
                <Image
                  src={activity.imageSrc}
                  alt={activity.imageAlt}
                  width={128}
                  height={128}
                  className="h-full w-full object-cover object-center"
                />
              </span>
              <span className="mt-4 text-sm font-medium font-sans text-white/90 hover:text-ocean-blue group-hover:text-ocean-blue transition-colors">
                {activity.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Mobile: horizontal scroll with snap points */}
      <ul className="mt-10 flex w-full snap-x snap-mandatory gap-8 overflow-x-auto pb-4 -mx-4 px-4 md:hidden">
        {SURF_ACTIVITIES.map((activity) => (
          <li
            key={activity.title}
            className="shrink-0 snap-start flex flex-col items-center text-center"
          >
            <Link
              href={activity.link}
              className="group flex flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-blue focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B] rounded-2xl"
            >
              <span className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full overflow-hidden shadow-lg shadow-black/20 ring-1 ring-white/10 transition-all group-hover:ring-ocean-blue/40 group-hover:shadow-[0_0_15px_rgba(74,112,217,0.15)]">
                <Image
                  src={activity.imageSrc}
                  alt={activity.imageAlt}
                  width={96}
                  height={96}
                  className="h-full w-full object-cover object-center"
                />
              </span>
              <span className="mt-4 text-sm font-medium font-sans text-white/90 hover:text-ocean-blue group-hover:text-ocean-blue transition-colors">
                {activity.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SectionWrapper>
  );
}
