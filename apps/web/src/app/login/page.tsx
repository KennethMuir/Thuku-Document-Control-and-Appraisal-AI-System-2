"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { clearSelectedOrganizationId } from "@/lib/organization/selection";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type LoginResponse = {
  success?: boolean;
  user?: {
    id: number;
    email: string;
    fullName: string | null;
    role: "ADMIN" | "APPRAISER" | "VIEWER";
    isActive: boolean;
  };
  error?: string;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";

const labelClassName =
  "mb-2 block text-sm font-medium text-slate-700";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      const data =
        (await response.json()) as LoginResponse;

      if (!response.ok || !data.success || !data.user) {
        throw new Error(data.error || "Unable to sign in.");
      }

      clearSelectedOrganizationId();
      router.push("/");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="WELCOME BACK"
      title="Sign in to your workspace"
      description="Continue managing your records, reviewing documents, and working with your organization."
      asideTitle="Your records, connected and under control."
      asideDescription="Return to a structured workspace built to help you manage document information and move reviews forward with confidence."
      features={[
        "Return to your organization workspace",
        "Continue your document review and appraisal workflow",
        "Access records according to your assigned permissions",
      ]}
      footer={
        <p className="text-center text-sm text-slate-500">
          New to Document Appraisal AI?{" "}
          <Link
            href="/signup"
            className="font-semibold text-indigo-700 transition hover:text-indigo-900"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className={labelClassName}>
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClassName}
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClassName}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClassName}
            placeholder="Enter your password"
          />
        </div>

        {error ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#283778] to-[#51408f] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/15 transition hover:from-[#202f69] hover:to-[#43337e] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
          {!loading ? <span aria-hidden="true">→</span> : null}
        </button>
      </form>

      <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-xs leading-5 text-slate-500">
          Your access is determined by your organization membership
          and assigned permissions.
        </p>
      </div>
    </AuthLayout>
  );
}
