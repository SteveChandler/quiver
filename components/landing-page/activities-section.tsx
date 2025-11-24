"use client";

import Link from "next/link";
import { SectionWrapper } from "./section-wrapper";
import { CONTENT, SURF_ACTIVITIES } from "@/lib/constants/features";
import { LucideIcon } from "lucide-react";

interface ActivityCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  link: string;
  iconBgColor: string;
  iconColor: string;
  delay: number;
}

function ActivityCard({
  icon: Icon,
  title,
  description,
  link,
  iconBgColor,
  iconColor,
  delay,
}: ActivityCardProps) {
  return (
    <div
      className="animate-fade-in-up"
      style={{ animationDelay: `${delay * 100}ms` }}
    >
      <Link href={link} className="block group">
        <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 h-full border border-gray-100">
          {/* Icon */}
          <div
            className={`${iconBgColor} ${iconColor} w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
          >
            <Icon className="h-7 w-7" />
          </div>

          {/* Content */}
          <h3 className="text-xl font-bold font-roboto text-dark-grey mb-2 group-hover:text-ocean-blue transition-colors">
            {title}
          </h3>
          <p className="text-gray-600 font-open-sans text-sm leading-relaxed">
            {description}
          </p>

          {/* Hover indicator */}
          <div className="mt-4 text-ocean-blue font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Explore →
          </div>
        </div>
      </Link>
    </div>
  );
}

export function ActivitiesSection() {
  return (
    <SectionWrapper
      title={CONTENT.sections.activities.title}
      subtitle={CONTENT.sections.activities.subtitle}
      centerContent
      className="py-20 px-4 bg-white"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {SURF_ACTIVITIES.map((activity, index) => (
          <ActivityCard key={activity.title} {...activity} delay={index} />
        ))}
      </div>

      {/* Additional info */}
      <div
        className="mt-12 text-center max-w-2xl mx-auto animate-fade-in"
        style={{ animationDelay: "600ms" }}
      >
        <p className="text-gray-600 font-open-sans">
          Whether you&apos;re a beginner looking for mellow waves or an expert
          seeking the gnarliest breaks, Quiver helps you find the perfect spot
          for your style.
        </p>
      </div>
    </SectionWrapper>
  );
}
