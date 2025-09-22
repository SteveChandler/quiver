interface MockPost {
  id: string;
  name: string;
  activity: string;
  imageUrl: string;
  avatar: string;
}

export const FALLBACK_POSTS: MockPost[] = [
  {
    id: "1",
    name: "John Stragen",
    activity: "La Jolla Shores",
    imageUrl: "/placeholder.jpg",
    avatar: "/placeholder-user.jpg",
  },
  {
    id: "2",
    name: "Olga Jin",
    activity: "Mission Beach",
    imageUrl: "/placeholder.jpg",
    avatar: "/placeholder-user.jpg",
  },
  {
    id: "3",
    name: "Livie Stausten",
    activity: "Windansea",
    imageUrl: "/placeholder.jpg",
    avatar: "/placeholder-user.jpg",
  },
  {
    id: "4",
    name: "Annie Chan",
    activity: "Trestles",
    imageUrl: "/placeholder.jpg",
    avatar: "/placeholder-user.jpg",
  },
];
