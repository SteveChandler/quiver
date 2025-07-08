"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { INTEL_FILTERS, getIntelTagConfig } from "@/lib/constants/intel";
import type { IntelPostTag } from "@/types/database";

interface IntelFiltersProps {
  selectedTag: IntelPostTag | "all";
  selectedRadius: number;
  onTagChange: (tag: IntelPostTag | "all") => void;
  onRadiusChange: (radius: number) => void;
  onReset: () => void;
  className?: string;
}

export function IntelFilters({
  selectedTag,
  selectedRadius,
  onTagChange,
  onRadiusChange,
  onReset,
  className = "",
}: IntelFiltersProps) {
  const handleRadiusChange = (value: number[]) => {
    onRadiusChange(value[0]);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Filters</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-8 px-2 text-xs"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* Intel Type Filter */}
      <div className="space-y-2">
        <Label htmlFor="tag-filter" className="text-xs font-medium">
          Intel Type
        </Label>
        <Select value={selectedTag} onValueChange={onTagChange}>
          <SelectTrigger id="tag-filter" className="h-9">
            <SelectValue placeholder="Select intel type" />
          </SelectTrigger>
          <SelectContent>
            {INTEL_FILTERS.TAG_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  {option.emoji && <span>{option.emoji}</span>}
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Show selected tag */}
        {selectedTag !== "all" && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <span className="mr-1">
                {getIntelTagConfig(selectedTag as IntelPostTag).emoji}
              </span>
              {getIntelTagConfig(selectedTag as IntelPostTag).label}
            </Badge>
          </div>
        )}
      </div>

      {/* Radius Filter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="radius-filter" className="text-xs font-medium">
            Search Radius
          </Label>
          <span className="text-xs text-muted-foreground">
            {selectedRadius} {selectedRadius === 1 ? "mile" : "miles"}
          </span>
        </div>

        <div className="px-2">
          <Slider
            id="radius-filter"
            min={1}
            max={50}
            step={1}
            value={[selectedRadius]}
            onValueChange={handleRadiusChange}
            className="w-full"
          />
        </div>

        {/* Quick radius options */}
        <div className="flex flex-wrap gap-1">
          {[1, 2, 5, 10, 25].map((radius) => (
            <Button
              key={radius}
              variant={selectedRadius === radius ? "default" : "outline"}
              size="sm"
              onClick={() => onRadiusChange(radius)}
              className="h-7 px-2 text-xs"
            >
              {radius} mi
            </Button>
          ))}
        </div>
      </div>

      {/* Filter Summary */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
        Showing{" "}
        <strong>
          {selectedTag === "all"
            ? "all intel types"
            : getIntelTagConfig(
                selectedTag as IntelPostTag
              ).label.toLowerCase()}
        </strong>{" "}
        within{" "}
        <strong>
          {selectedRadius} {selectedRadius === 1 ? "mile" : "miles"}
        </strong>
      </div>
    </div>
  );
}
