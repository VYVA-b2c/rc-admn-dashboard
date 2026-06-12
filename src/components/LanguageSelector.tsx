import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/translations";

const languages: { value: Language; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "de", label: "DE" },
  { value: "es", label: "ES" },
];

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center rounded-full border border-border bg-white p-0.5 text-[11px] shadow-sm">
      {languages.map((item) => (
        <button
          key={item.value}
          onClick={() => setLanguage(item.value)}
          className={`rounded-full px-2.5 py-1 font-semibold transition-colors ${
            language === item.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
