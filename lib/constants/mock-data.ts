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
    imageUrl: "/images/John.png",
    avatar: "/images/John.png",
  },
  {
    id: "2",
    name: "Olga Jin",
    activity: "Mission Beach",
    imageUrl: "/images/olga.png",
    avatar: "/images/olga.png",
  },
  {
    id: "3",
    name: "Livie Stausten",
    activity: "Windansea",
    imageUrl: "/images/Livie.png",
    avatar: "/images/Livie.png",
  },
  {
    id: "4",
    name: "Annie Chan",
    activity: "Trestles",
    imageUrl: "/images/annie.png",
    avatar: "/images/annie.png",
  },
];
