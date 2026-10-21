import type { ReactNode } from "react";

type AuthLayoutProps = {
  variant?: "default" | "signup";
  eyebrow: string;
  title: string;
  description: string;
  asideTitle: string;
  asideDescription: string;
  features: string[];
  children: ReactNode;
  footer: ReactNode;
};

export function AuthLayout({
  variant = "default",
  eyebrow,
  title,
  description,
  asideTitle,
  asideDescription,
  features,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <main className={`min-h-screen text-slate-900 ${variant === "signup" ? "bg-[#f7f8fc]" : "bg-[#f4f6fb]"}`}>
      <div className={`mx-auto grid min-h-screen w-full max-w-[1600px] ${variant === "signup" ? "lg:grid-cols-[0.92fr_1.08fr]" : "lg:grid-cols-2"}`}>
        <aside className={`relative hidden overflow-hidden px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-14 ${variant === "signup" ? "bg-gradient-to-br from-[#101a32] via-[#19264b] to-[#303b70]" : "bg-gradient-to-br from-[#101a38] via-[#202a63] to-[#51408f]"}`}>




          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-lg font-semibold shadow-lg shadow-indigo-950/20">
                D
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide">
                  Document Appraisal AI
                </p>
                <p className="mt-0.5 text-xs text-indigo-200">
                  Document intelligence platform
                </p>
              </div>
            </div>
          </div>

          <div className="relative my-16 max-w-xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-2 text-xs font-medium tracking-wide text-indigo-100">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
              INTELLIGENCE FOR YOUR RECORDS
            </p>

            <h2 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              {asideTitle}
            </h2>

            <p className="mt-6 max-w-lg text-base leading-7 text-indigo-100/80">
              {asideDescription}
            </p>

            <ul className="mt-9 space-y-4">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-indigo-200/25 bg-white/10 text-sm text-indigo-100">
                    ✓
                  </span>
                  <span className="text-sm leading-6 text-white/90">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-12 rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm">
              <p className="text-sm leading-6 text-indigo-50">
                Bring structure to your records, clarity to your review
                process, and confidence to your document decisions.
              </p>
            </div>
          </div>

          <p className="relative text-xs text-indigo-200/70">
            AI-powered document intelligence and records management
          </p>
        </aside>

        <section className={`flex min-w-0 items-center justify-center px-5 py-9 sm:px-8 sm:py-12 ${variant === "signup" ? "lg:px-10 xl:px-14" : "lg:px-12 xl:px-16"}`}>
          <div className={`w-full ${variant === "signup" ? "max-w-[520px]" : "max-w-[480px]"}`}>
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#202a63] to-[#51408f] text-base font-semibold text-white">
                D
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Document Appraisal AI
                </p>
                <p className="text-xs text-slate-500">
                  Document intelligence platform
                </p>
              </div>
            </div>

            <div className={`bg-white p-6 sm:p-9 ${variant === "signup" ? "rounded-2xl border border-slate-200 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.38)] sm:rounded-3xl" : "rounded-[28px] border border-slate-200/80 shadow-[0_24px_80px_-40px_rgba(25,35,80,0.28)]"}`}>
              <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${variant === "signup" ? "text-indigo-800" : "text-indigo-700"}`}>
                {eyebrow}
              </p>

              <h1 className={`mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[34px] ${variant === "signup" ? "leading-tight" : ""}`}>
                {title}
              </h1>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                {description}
              </p>

              <div className="mt-7">{children}</div>

              <div className="mt-7 border-t border-slate-100 pt-6">
                {footer}
              </div>
            </div>

            <p className="mt-6 px-3 text-center text-xs leading-5 text-slate-400">
              Secure access to your document intelligence workspace.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
