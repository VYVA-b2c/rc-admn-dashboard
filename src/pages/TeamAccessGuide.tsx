import { Link } from "react-router-dom";
import { BookOpenCheck, Home, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamAccessGuide() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">{t("teamGuide.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("teamGuide.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-primary" />
            {t("teamGuide.cardTitle")}
          </CardTitle>
          <CardDescription>{t("teamGuide.cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              {t("teamGuide.openDashboard")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/invite">
              <Users className="mr-2 h-4 w-4" />
              {t("teamGuide.manageTeam")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
