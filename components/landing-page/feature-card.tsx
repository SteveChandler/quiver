"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  features: Array<{
    icon: LucideIcon;
    text: string;
    color: string;
  }>;
  iconBgColor: string;
  iconColor: string;
  delay?: number;
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  features,
  iconBgColor,
  iconColor,
  delay = 0,
}: FeatureCardProps) {
  return (
    <motion.div {...ANIMATION_VARIANTS.staggerItem(delay)}>
      <Card className="h-full hover:shadow-lg transition-shadow duration-300 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <div
            className={`mx-auto mb-4 w-16 h-16 ${iconBgColor} rounded-full flex items-center justify-center`}
          >
            <Icon className={`h-8 w-8 ${iconColor}`} />
          </div>
          <h3 className="text-2xl font-heading font-bold text-dark-grey">
            {title}
          </h3>
        </CardHeader>
        <CardContent>
          <p className="font-sans text-gray-600 text-center mb-4">
            {description}
          </p>
          <ul className="space-y-2 text-sm font-sans text-gray-600">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2">
                <feature.icon className={`h-4 w-4 ${feature.color}`} />
                {feature.text}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  );
}
