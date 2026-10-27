import {
  Bell,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Coffee,
  Dumbbell,
  Flag,
  Heart,
  Home,
  Repeat,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

// A curated set a recurring template's icon can be — stored as `details.icon`
// (see recurringTemplate.ts), the same free-form JSON slot `time` lives in.
// 'repeat' (the generic recurrence glyph) is the default, and the fallback for
// a template saved before this existed or an unrecognized key.
export const RECURRING_ICONS: {
  key: string;
  icon: LucideIcon;
  label: string;
}[] = [
  { key: 'repeat', icon: Repeat, label: 'Repeat' },
  { key: 'bell', icon: Bell, label: 'Reminder' },
  { key: 'briefcase', icon: Briefcase, label: 'Work' },
  { key: 'coffee', icon: Coffee, label: 'Break' },
  { key: 'dumbbell', icon: Dumbbell, label: 'Fitness' },
  { key: 'book-open', icon: BookOpen, label: 'Study' },
  { key: 'heart', icon: Heart, label: 'Health' },
  { key: 'star', icon: Star, label: 'Important' },
  { key: 'home', icon: Home, label: 'Home' },
  { key: 'flag', icon: Flag, label: 'Milestone' },
  { key: 'check-circle', icon: CheckCircle2, label: 'Checklist' },
  { key: 'users', icon: Users, label: 'Meeting' },
];

const BY_KEY: Record<string, LucideIcon> = Object.fromEntries(
  RECURRING_ICONS.map(i => [i.key, i.icon]),
);

export const recurringIcon = (key: string): LucideIcon => BY_KEY[key] ?? Repeat;
