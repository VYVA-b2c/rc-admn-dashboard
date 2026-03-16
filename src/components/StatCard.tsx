import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  gradient: string;
  subtitle?: string;
}

export function StatCard({ title, value, icon, gradient, subtitle }: StatCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl p-6 text-primary-foreground shadow-lg ${gradient}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-90">{title}</p>
          <p className="mt-2 text-3xl font-display font-bold">{value}</p>
          {subtitle && <p className="mt-1 text-xs opacity-75">{subtitle}</p>}
        </div>
        <div className="rounded-lg bg-white/20 p-2.5">{icon}</div>
      </div>
      <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
    </div>
  );
}
