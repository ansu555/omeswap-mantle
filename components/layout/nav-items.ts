import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Compass,
  Cpu,
  Droplets,
  FlaskConical,
  Receipt,
  Store,
  Wallet,
  BookOpen,
} from "lucide-react";

export type AppNavItem = {
  name: string;
  url: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { name: "Explore", url: "/explore", icon: Compass },
  { name: "Trade", url: "/trade", icon: ArrowLeftRight },
  { name: "Liquidity", url: "/liquidity", icon: Droplets },
  { name: "Terminal", url: "/terminal", icon: FlaskConical, disabled: true },
  { name: "Portfolio", url: "/portfolio", icon: Wallet },
  { name: "Marketplace", url: "/marketplace", icon: Store },
  { name: "Txns", url: "/transactions", icon: Receipt },
  { name: "Builder", url: "/agent-builder", icon: Cpu },
  { name: "Research", url: "/research", icon: BookOpen },
];
