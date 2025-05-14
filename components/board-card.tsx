import { Card, CardContent } from "@/components/ui/card"
import { WavesIcon as Surfboard, CalendarDays, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface BoardCardProps {
  name: string
  type: string
  dimensions: string
  imageUrl: string
  sessionCount: number
}

export function BoardCard({ name, type, dimensions, imageUrl, sessionCount }: BoardCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="relative h-24 w-24 rounded-md overflow-hidden bg-muted">
            <Image src={imageUrl || "/placeholder.svg"} alt={name} fill className="object-cover" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium">{name}</h3>
            <p className="text-sm text-muted-foreground">{type}</p>
            <div className="flex items-center mt-1 text-sm">
              <Surfboard className="h-4 w-4 mr-1 text-primary" />
              <span>{dimensions}</span>
            </div>
            <div className="flex items-center mt-1 text-sm">
              <CalendarDays className="h-4 w-4 mr-1 text-primary" />
              <span>{sessionCount} sessions</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
