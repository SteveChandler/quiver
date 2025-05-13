"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, MapPin, List, MapIcon } from "lucide-react"
import { BeachCard } from "@/components/beach-card"

export function MapView() {
  const [viewMode, setViewMode] = useState<"map" | "list">("map")

  return (
    <div className="flex-1 flex flex-col">
      {/* Search Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search beaches..." className="pl-9" />
          </div>
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "map" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("map")}
            >
              <MapIcon className="h-4 w-4 mr-1" />
              Map
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>
        </div>
      </div>

      {/* Map View */}
      {viewMode === "map" && (
        <div className="flex-1 relative">
          <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
            <div className="text-center p-4">
              <MapPin className="h-12 w-12 text-primary mx-auto mb-2" />
              <p className="text-lg font-medium">Map View</p>
              <p className="text-sm text-muted-foreground">
                Interactive map would be displayed here with beach markers
              </p>
            </div>
          </div>

          {/* Beach Quick View */}
          <div className="absolute bottom-4 left-4 right-4">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-md bg-gray-200 flex items-center justify-center">
                    <MapPin className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Huntington Beach</h3>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 mr-1" />
                      <span>2.5 miles away</span>
                    </div>
                    <div className="flex items-center mt-1">
                      {Array(5)
                        .fill(0)
                        .map((_, i) => (
                          <MapPin
                            key={i}
                            className={`h-3 w-3 ${i < 4 ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
                          />
                        ))}
                      <span className="text-xs ml-1 text-muted-foreground">(128)</span>
                    </div>
                  </div>
                  <Button size="sm">Details</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="flex-1 p-4 space-y-4 overflow-auto pb-20">
          <BeachCard
            name="Huntington Beach"
            distance="2.5 miles"
            rating={4.5}
            reviewCount={128}
            imageUrl="/placeholder.svg?height=120&width=300"
          />
          <BeachCard
            name="Newport Beach"
            distance="5.8 miles"
            rating={4.2}
            reviewCount={96}
            imageUrl="/placeholder.svg?height=120&width=300"
          />
          <BeachCard
            name="Laguna Beach"
            distance="12.3 miles"
            rating={4.8}
            reviewCount={210}
            imageUrl="/placeholder.svg?height=120&width=300"
          />
          <BeachCard
            name="Trestles"
            distance="18.1 miles"
            rating={4.9}
            reviewCount={156}
            imageUrl="/placeholder.svg?height=120&width=300"
          />
          <BeachCard
            name="San Onofre"
            distance="20.5 miles"
            rating={4.6}
            reviewCount={89}
            imageUrl="/placeholder.svg?height=120&width=300"
          />
        </div>
      )}
    </div>
  )
}
