"use client"

import type React from "react"

import { useState, useRef } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, X, Camera, Instagram, Twitter } from "lucide-react"
import { updateProfile } from "@/actions/profile-actions"
import { useAuth } from "@/context/auth-context"
import { toast } from "@/components/ui/use-toast"
import { uploadImage, deleteImage } from "@/lib/image-upload"
import { UserAvatar } from "@/components/user-avatar"
import type { Beach, Board, Profile } from "@/types/database"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAllBeaches } from "@/actions/beach-actions"
import { getUserBoards, createBoard, deleteBoard } from "@/actions/board-actions"

const profileFormSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be less than 50 characters"),
  bio: z.string().max(300, "Bio must be less than 300 characters").optional(),
  location: z.string().max(100, "Location must be less than 100 characters").optional(),
  experience_level: z.string().max(50, "Experience level must be less than 50 characters").optional(),
  favorite_spot: z.string().max(100, "Favorite spot must be less than 100 characters").optional(),
  instagram: z.string().max(100, "Instagram handle must be less than 100 characters").optional(),
  twitter: z.string().max(100, "Twitter handle must be less than 100 characters").optional(),
})

const boardFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be less than 50 characters"),
  board_type: z.string().min(2, "Type must be at least 2 characters").max(50, "Type must be less than 50 characters"),
  dimensions: z
    .string()
    .min(2, "Dimensions must be at least 2 characters")
    .max(50, "Dimensions must be less than 50 characters"),
  description: z.string().max(300, "Description must be less than 300 characters").optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>
type BoardFormValues = z.infer<typeof boardFormSchema>

interface EditProfileModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: Profile | null
  onProfileUpdated: () => void
}

export function EditProfileModal({ open, onOpenChange, profile, onProfileUpdated }: EditProfileModalProps) {
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "")
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")
  const [beaches, setBeaches] = useState<Beach[]>([])
  const [selectedBeaches, setSelectedBeaches] = useState<string[]>([])
  const [boards, setBoards] = useState<Board[]>([])
  const [isLoadingBeaches, setIsLoadingBeaches] = useState(false)
  const [isLoadingBoards, setIsLoadingBoards] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
      bio: profile?.bio || "",
      location: profile?.location || "",
      experience_level: profile?.experience_level || "",
      favorite_spot: profile?.favorite_spot || "",
      instagram: profile?.instagram || "",
      twitter: profile?.twitter || "",
    },
  })

  const boardForm = useForm<BoardFormValues>({
    resolver: zodResolver(boardFormSchema),
    defaultValues: {
      name: "",
      board_type: "",
      dimensions: "",
      description: "",
    },
  })

  // Load beaches and boards when modal opens
  useState(() => {
    if (open && user) {
      loadBeaches()
      loadBoards()
    }
  })

  const loadBeaches = async () => {
    setIsLoadingBeaches(true)
    try {
      const result = await getAllBeaches()
      if (result.success) {
        setBeaches(result.data)
      }
    } catch (error) {
      console.error("Error loading beaches:", error)
    } finally {
      setIsLoadingBeaches(false)
    }
  }

  const loadBoards = async () => {
    if (!user) return

    setIsLoadingBoards(true)
    try {
      const result = await getUserBoards(user.id)
      if (result.success) {
        setBoards(result.data)
      }
    } catch (error) {
      console.error("Error loading boards:", error)
    } finally {
      setIsLoadingBoards(false)
    }
  }

  async function onSubmit(data: ProfileFormValues) {
    if (!user) return

    setIsSubmitting(true)
    try {
      const result = await updateProfile(user.id, {
        ...data,
        avatar_url: avatarUrl,
      })

      if (!result.success) {
        throw new Error(result.error || "Failed to update profile")
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      })

      onProfileUpdated()
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onSubmitBoard(data: BoardFormValues) {
    if (!user) return

    setIsSubmitting(true)
    try {
      const result = await createBoard(user.id, {
        ...data,
        image_url: null,
      })

      if (!result.success) {
        throw new Error(result.error || "Failed to create board")
      }

      toast({
        title: "Board added",
        description: "Your board has been added successfully.",
      })

      boardForm.reset()
      loadBoards()
    } catch (error) {
      console.error("Error creating board:", error)
      toast({
        title: "Error",
        description: "Failed to create board. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteBoard = async (boardId: string) => {
    if (!user) return

    try {
      const result = await deleteBoard(boardId, user.id)
      if (result.success) {
        toast({
          title: "Board deleted",
          description: "Your board has been deleted successfully.",
        })
        loadBoards()
      } else {
        throw new Error(result.error || "Failed to delete board")
      }
    } catch (error) {
      console.error("Error deleting board:", error)
      toast({
        title: "Error",
        description: "Failed to delete board. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      })
      return
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    try {
      // Delete old image if it exists and is not a placeholder
      if (avatarUrl && !avatarUrl.includes("placeholder.svg")) {
        await deleteImage(avatarUrl, "avatars")
      }

      // Upload new image
      const result = await uploadImage(file, "avatars", "profiles")
      if (!result.success) {
        throw new Error(result.error || "Failed to upload image")
      }

      setAvatarUrl(result.url)
      toast({
        title: "Image uploaded",
        description: "Your profile picture has been updated.",
      })
    } catch (error) {
      console.error("Error uploading avatar:", error)
      toast({
        title: "Error",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemoveAvatar = async () => {
    if (!avatarUrl || avatarUrl.includes("placeholder.svg")) return

    setIsUploading(true)
    try {
      // Delete the image
      await deleteImage(avatarUrl, "avatars")

      // Set to placeholder
      setAvatarUrl("/placeholder.svg?height=200&width=200")
      toast({
        title: "Image removed",
        description: "Your profile picture has been removed.",
      })
    } catch (error) {
      console.error("Error removing avatar:", error)
      toast({
        title: "Error",
        description: "Failed to remove image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const toggleBeach = (beachId: string) => {
    setSelectedBeaches((prev) => {
      if (prev.includes(beachId)) {
        return prev.filter((id) => id !== beachId)
      } else {
        return [...prev, beachId]
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your profile information and preferences</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="boards">Boards</TabsTrigger>
            <TabsTrigger value="beaches">Beaches</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4">
            <TabsContent value="profile" className="mt-0">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Avatar Upload */}
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <UserAvatar src={avatarUrl} name={form.getValues("full_name")} email={user?.email} size="xl" />
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                      )}
                      {avatarUrl && !avatarUrl.includes("placeholder.svg") && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={handleRemoveAvatar}
                          disabled={isUploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Change Photo
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={isUploading}
                      />
                    </div>
                  </div>

                  {/* Basic Info */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell us about yourself and your surfing journey"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input placeholder="Where are you based?" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Surf Info */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Surf Information</h3>

                    <FormField
                      control={form.control}
                      name="experience_level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Experience Level</FormLabel>
                          <FormControl>
                            <Input placeholder="Beginner, Intermediate, Advanced, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="favorite_spot"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Favorite Surf Spot</FormLabel>
                          <FormControl>
                            <Input placeholder="Your favorite place to catch waves" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Social Media */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Social Media</h3>

                    <FormField
                      control={form.control}
                      name="instagram"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            <Instagram className="h-4 w-4 mr-2" />
                            Instagram
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="@yourusername" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="twitter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            <Twitter className="h-4 w-4 mr-2" />
                            Twitter
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="@yourusername" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="boards" className="mt-0 space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Your Boards</h3>

                {isLoadingBoards ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : boards.length > 0 ? (
                  <div className="space-y-3">
                    {boards.map((board) => (
                      <Card key={board.id} className="relative">
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => handleDeleteBoard(board.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <CardContent className="p-4">
                          <div className="font-medium">{board.name}</div>
                          <div className="text-sm text-muted-foreground">{board.board_type}</div>
                          <div className="text-sm">{board.dimensions}</div>
                          {board.description && <div className="text-sm mt-1">{board.description}</div>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>You don't have any boards yet.</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Add New Board</h3>
                <Form {...boardForm}>
                  <form onSubmit={boardForm.handleSubmit(onSubmitBoard)} className="space-y-4">
                    <FormField
                      control={boardForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Board Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., My Shortboard" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={boardForm.control}
                      name="board_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Board Type</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Shortboard, Fish, Longboard" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={boardForm.control}
                      name="dimensions"
                      render={({ field }) =>
                        (
                          <FormItem>
                          <FormLabel>Dimensions</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 6'2\" x 19\" x 2.5\"" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                        )
                      }
                    />

                    <FormField
                      control={boardForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Tell us about your board" className="resize-none" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Add Board
                    </Button>
                  </form>
                </Form>
              </div>
            </TabsContent>

            <TabsContent value="beaches" className="mt-0">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Favorite Beaches</h3>

                {isLoadingBeaches ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : beaches.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {beaches.map((beach) => (
                      <Card
                        key={beach.id}
                        className={`cursor-pointer transition-colors ${
                          selectedBeaches.includes(beach.id) ? "border-primary" : ""
                        }`}
                        onClick={() => toggleBeach(beach.id)}
                      >
                        <CardContent className="p-3">
                          <div className="font-medium truncate">{beach.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{beach.location}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>No beaches available.</p>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Selected Beaches</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedBeaches.length > 0 ? (
                    selectedBeaches.map((beachId) => {
                      const beach = beaches.find((b) => b.id === beachId)
                      return beach ? (
                        <Badge key={beachId} variant="secondary" className="pl-2">
                          {beach.name}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 ml-1 hover:bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleBeach(beachId)
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ) : null
                    })
                  ) : (
                    <div className="text-sm text-muted-foreground">No beaches selected</div>
                  )}
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {activeTab === "profile" && (
            <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
