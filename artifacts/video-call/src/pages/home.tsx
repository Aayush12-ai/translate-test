import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { CardNav } from "@/components/card-nav";
import {
  ArrowRight,
  CalendarDays,
  Languages,
  Lock,
  LogIn,
  MoonStar,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Video,
} from "lucide-react";

type AppLanguage = "en" | "hi";

const LANGUAGE_STORAGE_KEY = "translate-test:homepage-language";

const COPY = {
  en: {
    brand: "Union Assist",
    nav: {
      login: "User Login",
      loginDesc: "Sign in to request meetings",
      admin: "Admin Login",
      adminDesc: "Open the admin dashboard",
      chat: "AI Chat",
      chatDesc: "Image analysis assistant",
      schedule: "Schedule",
      scheduleDesc: "Book appointments",
    },
    controls: {
      language: "Language",
      english: "English",
      hindi: "Hindi",
    },
    hero: {
      eyebrow: "Smart customer assistance workspace",
      title: "Union Bank Digital Assistant",
      subtitle:
        "Secure video calls, AI image analysis, and appointment booking with multilingual support.",
      primaryCta: "User Login",
      secondaryCta: "Admin Login",
      helperText:
        "Use email/password today, or enable Google OAuth from the server config for one-click sign-in.",
      chatLink: "Open AI Chat",
      scheduleLink: "Book Appointment",
      stats: [
        "Live translated video calls",
        "Groq AI image insights",
        "Secure appointment booking",
      ],
    },
    why: {
      title: "Why Choose Us?",
      secure: "Secure and Private",
      secureDesc:
        "End-to-end encrypted WebRTC video calls with password protection.",
      ai: "AI Powered",
      aiDesc:
        "Groq vision helps extract text, summarize images, and answer questions quickly.",
      booking: "Easy Booking",
      bookingDesc:
        "Request meetings from your account and let admins schedule them securely.",
    },
    header: {
      userLogin: "User Login",
      adminLogin: "Admin Login",
    },
  },
  hi: {
    brand: "Union Assist",
    nav: {
      login: "User Login",
      loginDesc: "Meeting request ke liye sign in karein",
      admin: "Admin Login",
      adminDesc: "Admin dashboard kholein",
      chat: "AI Chat",
      chatDesc: "Image analysis assistant",
      schedule: "Schedule",
      scheduleDesc: "Appointment book karein",
    },
    controls: {
      language: "Bhasha",
      english: "English",
      hindi: "Hindi",
    },
    hero: {
      eyebrow: "Smart customer assistance workspace",
      title: "Union Bank Digital Assistant",
      subtitle:
        "Secure video calls, AI image analysis, aur multilingual appointment booking ek jagah.",
      primaryCta: "User Login",
      secondaryCta: "Admin Login",
      helperText:
        "Email/password abhi active hai, aur server config ke baad Google OAuth bhi use kar sakte hain.",
      chatLink: "AI Chat Kholein",
      scheduleLink: "Appointment Book Karein",
      stats: [
        "Live translated video calls",
        "Groq AI image insights",
        "Secure appointment booking",
      ],
    },
    why: {
      title: "Why Choose Us?",
      secure: "Secure and Private",
      secureDesc:
        "Password-protected WebRTC video calls ke saath better privacy.",
      ai: "AI Powered",
      aiDesc:
        "Groq vision text nikalta hai, image summarize karta hai, aur sawalon ka jawab deta hai.",
      booking: "Easy Booking",
      bookingDesc:
        "User account se request bhejein aur admin secure tareeke se schedule kare.",
    },
    header: {
      userLogin: "User Login",
      adminLogin: "Admin Login",
    },
  },
} as const;

export function Home() {
  const [language, setLanguage] = useState<AppLanguage>("en");
  const { resolvedTheme, setTheme } = useTheme();
  const copy = COPY[language];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedLanguage = localStorage.getItem(
      LANGUAGE_STORAGE_KEY,
    ) as AppLanguage | null;
    if (savedLanguage) {
      setLanguage(savedLanguage);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const navItems = useMemo(
    () => [
      {
        id: "login",
        title: copy.nav.login,
        description: copy.nav.loginDesc,
        icon: LogIn,
        href: "/login",
      },
      {
        id: "admin",
        title: copy.nav.admin,
        description: copy.nav.adminDesc,
        icon: Lock,
        href: "/admin/login",
      },
      {
        id: "chat",
        title: copy.nav.chat,
        description: copy.nav.chatDesc,
        icon: Sparkles,
        href: "/chat",
      },
      {
        id: "schedule",
        title: copy.nav.schedule,
        description: copy.nav.scheduleDesc,
        icon: CalendarDays,
        href: "/schedule",
      },
    ],
    [copy],
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/30 dark:from-slate-900/50 dark:to-slate-800/30" />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel mx-auto mb-20 max-w-5xl rounded-3xl p-8 backdrop-blur-xl"
        >
          <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/images/union-bank-logo.svg"
                alt="Union Bank"
                className="h-16 w-auto drop-shadow-2xl"
              />
              <div>
                <h1 className="bg-gradient-to-r from-primary to-union-gold bg-clip-text text-3xl font-black text-transparent lg:text-4xl">
                  {copy.brand}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-2xl border border-primary/25 bg-white/85 px-4 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:border-primary/60 hover:shadow-lg"
              >
                <LogIn className="h-4 w-4" />
                {copy.header.userLogin}
              </Link>
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <Lock className="h-4 w-4" />
                {copy.header.adminLogin}
              </Link>

              <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-card/80 px-4 py-2.5 backdrop-blur-sm">
                <Languages className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">
                  {copy.controls.language}
                </span>
                <button
                  onClick={() => setLanguage("en")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    language === "en"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {copy.controls.english}
                </button>
                <button
                  onClick={() => setLanguage("hi")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    language === "hi"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {copy.controls.hindi}
                </button>
              </div>

              <button
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
                className="grid place-items-center rounded-2xl border border-border/50 bg-card/80 p-3 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-xl"
                title="Toggle theme"
              >
                {resolvedTheme === "dark" ? (
                  <SunMedium className="h-6 w-6" />
                ) : (
                  <MoonStar className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-12">
            <CardNav items={navItems} basePath="/" />
          </div>
        </motion.header>

        <section className="grid gap-16 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-3 rounded-2xl bg-primary/10 px-6 py-3 font-semibold text-primary backdrop-blur-sm">
              <Sparkles className="h-5 w-5" />
              <span>{copy.hero.eyebrow}</span>
            </div>

            <h1 className="bg-gradient-to-r from-slate-900 via-primary to-union-gold bg-clip-text text-6xl font-black leading-tight text-transparent lg:text-8xl">
              {copy.hero.title}
            </h1>

            <p className="max-w-3xl text-2xl leading-relaxed text-muted-foreground">
              {copy.hero.subtitle}
            </p>

            <div className="flex flex-wrap gap-6">
              <Link
                href="/login"
                className="group flex items-center gap-4 rounded-3xl bg-gradient-to-r from-primary to-union-gold px-10 py-6 text-xl font-bold text-primary-foreground shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-3xl"
              >
                <LogIn className="h-7 w-7 transition-all group-hover:rotate-12" />
                {copy.hero.primaryCta}
                <ArrowRight className="h-7 w-7 transition-all group-hover:translate-x-2" />
              </Link>

              <Link
                href="/admin/login"
                className="flex items-center gap-3 rounded-3xl border-2 border-primary/30 bg-card/80 px-10 py-6 text-xl font-bold backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-primary hover:bg-card hover:shadow-2xl"
              >
                <Lock className="h-6 w-6" />
                {copy.hero.secondaryCta}
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>{copy.hero.helperText}</span>
              <Link href="/chat" className="font-semibold text-primary hover:underline">
                {copy.hero.chatLink}
              </Link>
              <Link
                href="/schedule"
                className="font-semibold text-primary hover:underline"
              >
                {copy.hero.scheduleLink}
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {copy.hero.stats.map((stat, index) => (
                <motion.div
                  key={stat}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="glass-panel group rounded-3xl p-8 transition-all hover:shadow-2xl"
                >
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/20 text-primary transition-transform group-hover:scale-110">
                    {index === 0 ? (
                      <Video className="h-10 w-10" />
                    ) : index === 1 ? (
                      <Sparkles className="h-10 w-10" />
                    ) : (
                      <CalendarDays className="h-10 w-10" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stat}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel rounded-3xl p-12 shadow-2xl lg:sticky lg:top-32"
          >
            <div>
              <h3 className="mb-8 bg-gradient-to-r from-primary to-union-gold bg-clip-text text-3xl font-bold text-transparent">
                {copy.why.title}
              </h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4 rounded-2xl bg-card/50 p-6 transition-colors hover:bg-card">
                  <div className="mt-0.5 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/20">
                    <ShieldCheck className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h4 className="mb-2 text-xl font-semibold">
                      {copy.why.secure}
                    </h4>
                    <p className="leading-relaxed text-muted-foreground">
                      {copy.why.secureDesc}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl bg-card/50 p-6 transition-colors hover:bg-card">
                  <div className="mt-0.5 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/20">
                    <Sparkles className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h4 className="mb-2 text-xl font-semibold">{copy.why.ai}</h4>
                    <p className="leading-relaxed text-muted-foreground">
                      {copy.why.aiDesc}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl bg-card/50 p-6 transition-colors hover:bg-card">
                  <div className="mt-0.5 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/20">
                    <CalendarDays className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h4 className="mb-2 text-xl font-semibold">
                      {copy.why.booking}
                    </h4>
                    <p className="leading-relaxed text-muted-foreground">
                      {copy.why.bookingDesc}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
