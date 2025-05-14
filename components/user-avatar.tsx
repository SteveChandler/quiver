import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
  src?: string | null
  name?: string | null
  email?: string | null
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

export function UserAvatar({ src, name, email, size = "md", className }: UserAvatarProps) {
  // Get initials for avatar fallback
  const getInitials = () => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    }
    if (email) {
      return email.charAt(0).toUpperCase()
    }
    return "U"
  }

  // Size classes
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
  }

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={src || undefined} alt={name || "User"} />
      <AvatarFallback className="bg-blue-500 text-white">{getInitials()}</AvatarFallback>
    </Avatar>
  )
}
