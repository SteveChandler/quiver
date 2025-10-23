"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Waves, Car, Users, AlertTriangle, MapPin } from "lucide-react";

interface PracticalTipsSectionProps {
  parkingTips?: string | null;
  accessTips?: string | null;
  waveTips?: string | null;
  crowdTips?: string | null;
  bestConditionsProse?: string | null;
  warnings?: string[];
  className?: string;
}

export function PracticalTipsSection({
  parkingTips,
  accessTips,
  waveTips,
  crowdTips,
  bestConditionsProse,
  warnings,
  className,
}: PracticalTipsSectionProps) {
  const hasTips =
    parkingTips ||
    accessTips ||
    waveTips ||
    crowdTips ||
    bestConditionsProse ||
    (warnings && warnings.length > 0);

  if (!hasTips) return null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Local Knowledge</CardTitle>
        <p className="text-sm text-muted-foreground">
          Insider tips from local surfers
        </p>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {/* Best Conditions */}
          {bestConditionsProse && (
            <AccordionItem value="conditions">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Waves className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold">Best Conditions</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm leading-relaxed text-muted-foreground pl-6">
                  {bestConditionsProse}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Parking */}
          {parkingTips && (
            <AccordionItem value="parking">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold">Parking</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm leading-relaxed text-muted-foreground pl-6">
                  {parkingTips}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Access */}
          {accessTips && (
            <AccordionItem value="access">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold">Access</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm leading-relaxed text-muted-foreground pl-6">
                  {accessTips}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Wave Tips */}
          {waveTips && (
            <AccordionItem value="waves">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Waves className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold">Wave Characteristics</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm leading-relaxed text-muted-foreground pl-6">
                  {waveTips}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Crowd */}
          {crowdTips && (
            <AccordionItem value="crowd">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold">Crowd Info</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm leading-relaxed text-muted-foreground pl-6">
                  {crowdTips}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Warnings */}
          {warnings && warnings.length > 0 && (
            <AccordionItem value="warnings">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="font-semibold">Safety & Hazards</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 pl-6">
                  {warnings.map((warning, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
