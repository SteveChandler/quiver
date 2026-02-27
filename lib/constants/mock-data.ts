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
    imageUrl: "/images/John.jpg",
    avatar: "/images/John.jpg",
  },
  {
    id: "2",
    name: "Olga Jin",
    activity: "Mission Beach",
    imageUrl: "/images/olga.jpg",
    avatar: "/images/olga.jpg",
  },
  {
    id: "3",
    name: "Livie Stausten",
    activity: "Windansea",
    imageUrl: "/images/Livie.jpg",
    avatar: "/images/Livie.jpg",
  },
  {
    id: "4",
    name: "Annie Chan",
    activity: "Trestles",
    imageUrl: "/images/annie.jpg",
    avatar: "/images/annie.jpg",
  },
];
