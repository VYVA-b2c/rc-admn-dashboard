import { useLanguage } from "@/contexts/LanguageContext";

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center rounded-full border border-border bg-muted/50 p-0.5 text-xs">
      <button
        onClick={() => setLanguage("en")}
        className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
          language === "en"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage("de")}
        className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
          language === "de"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        DE
      </button>
    </div>
  );
}
