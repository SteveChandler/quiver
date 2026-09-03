"use client";

import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getIntentSlug } from "@/lib/utils/slug-helpers";

interface AboutAccordionProps {
  cityName: string;
  citySlug: string;
  stateSlug?: string;
  description: string[];
  topSpotSlug?: string;
  topSpotName?: string;
}

/**
 * About Accordion Component
 *
 * Collapsible "About {City} Surf" section with:
 * - Editorial paragraphs about the city's surf culture
 * - Dynamic links to top spots and less-crowded guides
 */
export function AboutAccordion({
  cityName,
  citySlug,
  stateSlug,
  description,
  topSpotSlug,
  topSpotName,
}: AboutAccordionProps) {
  if (!description || description.length === 0) return null;

  const intentSlug = getIntentSlug(citySlug, stateSlug);

  return (
    <section className="mt-12">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="about" className="rounded-[8px_18px_6px_16px] border-2 border-[#11100D]/85 bg-[#FBF6E8] px-5 shadow-[3px_4px_0_rgba(17,16,13,0.18)]">
          <AccordionTrigger className="text-xl font-semibold text-slate-900 hover:no-underline">
            About {cityName} Surf
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 text-base leading-relaxed text-slate-700 pb-4">
              {description.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}

              {/* Dynamic closing paragraphs */}
              <p>
                Today&apos;s playbook: set alerts for the morning low tide, grab a
                coffee near the lot, and keep an eye on wind reversals after 10
                a.m. Quiver tracks hourly condition changes so you can decide
                whether to stay local or hop up the coast toward{" "}
                {topSpotSlug && topSpotName ? (
                  <Link
                    href={`/spots/${topSpotSlug}`}
                    className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                  >
                    {topSpotName}
                  </Link>
                ) : (
                  "the top spot"
                )}
                .
              </p>
              <p>
                Weekend outlook: pair the incoming tide push with a backup parking
                plan. If the headline reef is shoulder-to-shoulder, slide to the
                secondary peak listed below or jump into the{" "}
                <Link
                  href={`/least-crowded/${intentSlug}`}
                  className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                >
                  less-crowded guide
                </Link>{" "}
                for real-time alternates.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
