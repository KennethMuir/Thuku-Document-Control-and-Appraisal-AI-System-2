"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type VerificationStatus =
  | "checking"
  | "verified"
  | "invalid"
  | "failed";

type VerificationResponse = {
  success?: boolean;
  verified?: boolean;
  message?: string;
  error?: string;
  code?: string;
};

function VerificationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [status, setStatus] = useState<VerificationStatus>("checking");
  const [message, setMessage] = useState(
    "Checking your verification link..."
  );

  useEffect(() => {
    let active = true;

    async function verifyEmail() {
      if (!/^[a-f0-9]{64}$/i.test(token)) {
        setStatus("invalid");
        setMessage(
          "This verification link is missing a valid token. Open the latest verification email or contact support."
        );
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/auth/verify-company-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
          }
        );

        const data = (await response.json()) as VerificationResponse;

        if (!active) return;

        if (response.ok && data.success && data.verified) {
          setStatus("verified");
          setMessage(
            data.message ||
              "Your company email is verified. You can now sign in."
          );
          return;
        }

        setStatus("invalid");
        setMessage(
          data.error ||
            "This verification link is invalid or has expired. Contact support for assistance."
        );
      } catch {
        if (!active) return;
        setStatus("failed");
        setMessage(
          "We could not reach the verification service. Check your connection and reopen this link to try again."
        );
      }
    }

    void verifyEmail();

    return () => {
      active = false;
    };
  }, [token]);

  const verified = status === "verified";

  return (
    <AuthLayout
      eyebrow="EMAIL VERIFICATION"
      title={verified ? "Email verified" : "Verify your company email"}
      description={
        verified
          ? "Your company email verification is complete."
          : "We are checking the verification link for your organization."
      }
      asideTitle="A secure start for your workspace."
      asideDescription="Company email verification helps protect access to your document management workspace."
      features={[
        "Organization workspace access",
        "A 14-day trial with up to 10 documents",
        "Secure sign-in after verification",
      ]}
      footer={
        <p className="text-center text-sm text-slate-500">
          Need to create an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-indigo-700 transition hover:text-indigo-900"
          >
            Sign up
          </Link>
        </p>
      }
    >
      <div
        aria-live="polite"
        className={`rounded-2xl border p-5 ${
          verified
            ? "border-emerald-200 bg-emerald-50/70"
            : status === "checking"
              ? "border-indigo-100 bg-indigo-50/70"
              : "border-amber-200 bg-amber-50/70"
        }`}
      >
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm ring-1 ring-slate-100">
          {status === "checking" ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6 animate-spin"
            >
              <path
                d="M12 3a9 9 0 1 0 9 9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : verified ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6 text-emerald-700"
            >
              <path
                d="m5 12 4 4L19 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6 text-amber-700"
            >
              <path
                d="M12 8v5m0 3h.01M10.3 4.7 2.9 17.5A1.7 1.7 0 0 0 4.4 20h15.2a1.7 1.7 0 0 0 1.5-2.5L13.7 4.7a1.95 1.95 0 0 0-3.4 0Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <h2 className="text-base font-semibold text-slate-900">
          {status === "checking"
            ? "Verifying your link"
            : verified
              ? "Verification successful"
              : status === "failed"
                ? "Verification service unavailable"
                : "Unable to verify this link"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
      </div>

      {verified ? (
        <Link
          href="/login"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/10 transition hover:bg-indigo-800"
        >
          Continue to sign in
          <span aria-hidden="true">→</span>
        </Link>
      ) : status === "failed" ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-indigo-700 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-800"
        >
          Try again
        </button>
      ) : null}

      {!verified && status !== "checking" && (
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          For your security, verification links can only be used once and may
          expire. If you still need help, contact support.
        </p>
      )}
    </AuthLayout>
  );
}

export default function VerifyCompanyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout
          eyebrow="EMAIL VERIFICATION"
          title="Loading verification"
          description="Preparing your secure verification link."
          asideTitle="A secure start for your workspace."
          asideDescription="Confirm your company email before signing in."
          features={[
            "Organization workspace access",
            "A 14-day trial with up to 10 documents",
            "Secure sign-in after verification",
          ]}
          footer={
            <p className="text-center text-sm text-slate-500">
              Need to create an account?{" "}
              <Link
                href="/signup"
                className="font-semibold text-indigo-700 transition hover:text-indigo-900"
              >
                Sign up
              </Link>
            </p>
          }
        >
          <p className="text-sm text-slate-600" aria-live="polite">
            Loading verification...
          </p>
        </AuthLayout>
      }
    >
      <VerificationContent />
    </Suspense>
  );
}