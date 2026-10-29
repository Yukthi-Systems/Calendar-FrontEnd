import Bell from 'lucide-react-native/icons/bell';
import BookOpen from 'lucide-react-native/icons/book-open';
import Briefcase from 'lucide-react-native/icons/briefcase';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Coffee from 'lucide-react-native/icons/coffee';
import Dumbbell from 'lucide-react-native/icons/dumbbell';
import Flag from 'lucide-react-native/icons/flag';
import Heart from 'lucide-react-native/icons/heart';
import Home from 'lucide-react-native/icons/house';
import Repeat from 'lucide-react-native/icons/repeat';
import Star from 'lucide-react-native/icons/star';
import Users from 'lucide-react-native/icons/users';
import type { LucideIcon } from 'lucide-react-native';

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
