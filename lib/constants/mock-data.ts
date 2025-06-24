export interface MockPost {
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

export const FORECAST_DATA = [
  {
    day: "Today",
    date: "Dec 15",
    waveHeight: "3.17",
    windSpeed: "4 mph",
    waterTemp: "65°F",
  },
  {
    day: "Tomorrow",
    date: "Dec 16",
    waveHeight: "5.27",
    windSpeed: "18 mph",
    waterTemp: "64°F",
  },
  {
    day: "Thu",
    date: "Dec 17",
    waveHeight: "2.05",
    windSpeed: "12 mph",
    waterTemp: "65°F",
  },
];
