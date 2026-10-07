import {
  BarChart3,
  Brain,
  ChefHat,
  Cpu,
  FileText,
  LayoutDashboard,
  Package,
  Recycle,
  Settings,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Brain,
  Users,
  ChefHat,
  UtensilsCrossed,
  TrendingUp,
  Package,
  ShoppingCart,
  Trash2,
  BarChart3,
  Recycle,
  Cpu,
  FileText,
  Settings,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = MAP[name] ?? LayoutDashboard;
  return <Cmp className={className} />;
}
