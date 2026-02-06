import type { ComponentType } from "react";
import {
  Bot,
  Sparkles,
  Cpu,
  Globe,
  Zap,
  Star,
  Shield,
  Rocket,
  Compass,
  Brain,
  Code2,
  Layers,
  Flame,
  Wind,
  Moon,
  Sun,
  Cloud,
  Leaf,
  Hexagon,
  Atom,
} from "lucide-react";

const AVATAR_ICONS: ComponentType<{ className?: string }>[] = [
  Bot,
  Sparkles,
  Cpu,
  Globe,
  Zap,
  Star,
  Shield,
  Rocket,
  Compass,
  Brain,
  Code2,
  Layers,
  Flame,
  Wind,
  Moon,
  Sun,
  Cloud,
  Leaf,
  Hexagon,
  Atom,
];

let cachedIndex: number | null = null;

export const getAvatarIcon = () => {
  if (cachedIndex === null) {
    cachedIndex = Math.floor(Math.random() * AVATAR_ICONS.length);
  }
  return AVATAR_ICONS[cachedIndex];
};
