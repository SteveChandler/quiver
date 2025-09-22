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
    imageUrl:
      "https://images.unsplash.com/photo-1502933691298-84fc14542831?w=400&h=400&fit=crop&crop=center",
    avatar: "/placeholder-user.jpg",
  },
  {
    id: "2",
    name: "Olga Jin",
    activity: "Mission Beach",
    imageUrl:
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=400&fit=crop&crop=center",
    avatar: "/placeholder-user.jpg",
  },
  {
    id: "3",
    name: "Livie Stausten",
    activity: "Windansea",
    imageUrl:
      "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&h=400&fit=crop&crop=center",
    avatar: "/placeholder-user.jpg",
  },
  {
    id: "4",
    name: "Annie Chan",
    activity: "Trestles",
    imageUrl:
      "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=400&h=400&fit=crop&crop=center",
    avatar: "/placeholder-user.jpg",
  },
];
