import { Users, PhoneCall, Brain, Pill, Heart } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={<Users className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-vyva-purple to-primary"
          subtitle="Onboarded via agent"
        />
        <StatCard
          title="Check-ins Active"
          value={stats?.checkinsEnabled ?? 0}
          icon={<PhoneCall className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-vyva-teal to-secondary"
          subtitle="Users with check-ins on"
        />
        <StatCard
          title="Brain Coach"
          value={stats?.brainCoachEnabled ?? 0}
          icon={<Brain className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-vyva-gold to-accent"
          subtitle="Active brain coaching"
        />
        <StatCard
          title="On Medication"
          value={stats?.medicationsConfigured ?? 0}
          icon={<Pill className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-vyva-pink to-destructive"
          subtitle="With medication schedules"
        />
        <StatCard
          title="Caregivers"
          value={stats?.caregiversLinked ?? 0}
          icon={<Heart className="h-5 w-5" />}
          gradient="bg-gradient-to-br from-vyva-green to-secondary"
          subtitle="Linked caregiver contacts"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Users by City</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.cityDistribution && stats.cityDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.cityDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="city" className="text-xs" />
                <YAxis allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "0.5rem",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-muted-foreground">No user data yet. Data will appear here once the onboarding agent sends user records.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
