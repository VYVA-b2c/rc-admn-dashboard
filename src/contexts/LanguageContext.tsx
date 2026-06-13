import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type Language, getTranslation } from "@/lib/translations";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function normalizeLanguage(value?: string | null): Language {
  const lang = value?.toLowerCase();
  if (lang?.startsWith("de")) return "de";
  if (lang?.startsWith("es")) return "es";
  return "en";
}

function getInitialLanguage(): Language {
  const stored = localStorage.getItem("app-language");
  if (stored === "en" || stored === "de" || stored === "es") return stored;
  return normalizeLanguage(navigator.language);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => getInitialLanguage());

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app-language", lang);

    if (supabaseConfigured) {
      void supabase.auth.getSession().then(({ data }) => {
        if (!data.session) return;
        return supabase.auth.updateUser({
          data: {
            language: lang,
            email_language: lang,
          },
        });
      });
    }
  }, []);

  const t = useCallback((key: string) => getTranslation(language, key), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
