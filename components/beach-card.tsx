import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Star } from "lucide-react"
import Image from "next/image"

interface BeachCardProps {
  name: string
  distance: string
  rating: number
  reviewCount: number
  imageUrl: string
}

export function BeachCard({ name, distance, rating, reviewCount, imageUrl }: BeachCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-32">
        <Image src={imageUrl || "/placeholder.svg"} alt={name} fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 p-3 text-white">
          <h3 className="font-semibold text-lg">{name}</h3>
          <div className="flex items-center text-sm">
            <MapPin className="h-4 w-4 mr-1" />
            <span>{distance}</span>
          </div>
        </div>
      </div>
      <CardContent className="p-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Star className="h-4 w-4 text-yellow-500 mr-1 fill-yellow-500" />
            <span className="font-medium">{rating}</span>
            <span className="text-muted-foreground text-sm ml-1">({reviewCount} reviews)</span>
          </div>
          <button className="text-primary text-sm font-medium">View Details</button>
        </div>
      </CardContent>
    </Card>
  )
}
