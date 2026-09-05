export const categories = [
  '全部',
  '视觉设计',
  '手作生活',
  '摄影影像',
  '音乐现场',
  '灵感闲聊',
] as const;
export type Category = (typeof categories)[number];
export interface User {
  id: string;
  name: string;
  email: string;
  color: string;
}
export interface Activity {
  id: string;
  title: string;
  description: string;
  category: string;
  host: string;
  ownerId: string;
  cover: string;
  status: 'live' | 'scheduled' | 'ended';
  startsAt: string;
  duration: number;
  seats: number;
  count: number;
  reserved: boolean;
  demo: boolean;
  tag: string;
  tasks: string[];
}
export interface Circle {
  id: string;
  title: string;
  description: string;
  category: string;
  cover: string;
  members: number;
  joined: boolean;
  color: string;
}
export interface Work {
  id: string;
  userId: string;
  title: string;
  description: string;
  image: string;
  author: string;
  activityId: string | null;
  activityTitle: string | null;
  likes: number;
  liked: boolean;
  createdAt: string;
}
export interface ChatMessage {
  id: string;
  userId: string;
  author: string;
  color: string;
  text: string;
  createdAt: string;
}
export interface Bootstrap {
  user: User | null;
  activities: Activity[];
  circles: Circle[];
  works: Work[];
}
export interface Poll {
  options: { label: string; votes: number }[];
  selected: number | null;
}
