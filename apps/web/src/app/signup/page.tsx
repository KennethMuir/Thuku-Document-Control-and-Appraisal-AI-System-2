"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type SignupResponse = {
  success?: boolean;
  verificationRequired?: boolean;
  verificationEmailSent?: boolean;
  message?: string;
  user?: {
    id: number;
    email: string;
    fullName: string | null;
    role: "ADMIN" | "APPRAISER" | "VIEWER";
    isActive: boolean;
  };
  organization?: {
    id: number;
    name: string;
    companyEmail: string;
    industryKey: string;
  };
  trial?: {
    durationDays: number;
    documentLimit: number;
  };
  error?: string;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";

const labelClassName =
  "mb-2 block text-sm font-medium text-slate-700";

const industries = [
  { value: "government_public_administration", label: "Government & Public Administration" },
  { value: "international_intergovernmental_organization", label: "International & Intergovernmental Organization" },
  { value: "nonprofit_civil_society", label: "Nonprofit & Civil Society" },
  { value: "community_social_services", label: "Community & Social Services" },
  { value: "banking_financial_services", label: "Banking & Financial Services" },
  { value: "insurance", label: "Insurance" },
  { value: "investment_capital_markets", label: "Investment & Capital Markets" },
  { value: "legal_services", label: "Legal Services" },
  { value: "accounting_audit_services", label: "Accounting & Audit Services" },
  { value: "consulting_professional_services", label: "Consulting & Professional Services" },
  { value: "education", label: "Education" },
  { value: "research_institution", label: "Research Institution" },
  { value: "healthcare", label: "Healthcare" },
  { value: "pharmaceutical_life_sciences", label: "Pharmaceutical & Life Sciences" },
  { value: "information_technology", label: "Information Technology" },
  { value: "telecommunications", label: "Telecommunications" },
  { value: "media_publishing", label: "Media & Publishing" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "construction", label: "Construction" },
  { value: "engineering_services", label: "Engineering Services" },
  { value: "mining_extractives", label: "Mining & Extractive Industries" },
  { value: "energy_utilities", label: "Energy & Utilities" },
  { value: "retail_wholesale", label: "Retail & Wholesale" },
  { value: "sales_distribution", label: "Sales & Distribution" },
  { value: "hospitality_tourism", label: "Hospitality & Tourism" },
  { value: "aviation", label: "Aviation" },
  { value: "maritime_shipping", label: "Maritime & Shipping" },
  { value: "rail_public_transport", label: "Rail & Public Transport" },
  { value: "logistics_freight", label: "Logistics & Freight" },
  { value: "agriculture", label: "Agriculture" },
  { value: "forestry", label: "Forestry" },
  { value: "fisheries", label: "Fisheries" },
  { value: "real_estate_property", label: "Real Estate & Property" },
  { value: "facilities_infrastructure_services", label: "Facilities & Infrastructure Services" },
  { value: "research_development", label: "Research & Development" },
  { value: "other_general_commercial", label: "Other / General Commercial" },
] as const;

const jobPositions = [
  "Chief Executive Officer",
  "Managing Director",
  "Director",
  "Head of Department",
  "Records Manager",
  "Information or Knowledge Manager",
  "Document Controller",
  "Compliance Officer",
  "IT Manager",
  "Operations Manager",
  "Administrator",
  "Appraiser",
  "Other",
] as const;

export default function SignupPage() {

  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [industryKey, setIndustryKey] = useState("");
  const [industryOther, setIndustryOther] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [jobPosition, setJobPosition] = useState("");
  const [jobTitleOther, setJobTitleOther] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<
    "idle" | "requested" | "failed"
  >("idle");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!companyName.trim() || !companyEmail.trim()) {
      setError("Enter your company name and company email.");
      return;
    }

    if (!industryKey) {
      setError("Select your industry or business domain.");
      return;
    }

    if (
      industryKey === "other_general_commercial" &&
      !industryOther.trim()
    ) {
      setError("Specify your industry or business domain.");
      return;
    }

    if (!fullName.trim() || !email.trim() || !jobPosition) {
      setError("Complete all workspace owner details.");
      return;
    }

    if (jobPosition === "Other" && !jobTitleOther.trim()) {
      setError("Enter your job title.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!termsAccepted) {
      setError("You must accept the terms to create an account.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          companyName: companyName.trim(),
          companyEmail: companyEmail.trim(),
          industryKey,
          industryOther:
            industryKey === "other_general_commercial"
              ? industryOther.trim()
              : "",
          fullName: fullName.trim(),
          email: email.trim(),
          jobPosition,
          jobTitleOther:
            jobPosition === "Other" ? jobTitleOther.trim() : "",
          password,
          confirmPassword,
          termsAccepted,
        }),
      });

      const data = (await response.json()) as SignupResponse;

      if (!response.ok || !data.success || !data.verificationRequired) {
        throw new Error(
          data.error || "Unable to create your workspace."
        );
      }

      setVerificationEmailSent(Boolean(data.verificationEmailSent));
      setSignupComplete(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create your workspace."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendLoading) return;

    setResendLoading(true);
    setResendStatus("idle");

    try {
      const response = await fetch(
        `${API_URL}/api/auth/resend-company-email-verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyEmail: companyEmail.trim(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error("The request could not be processed.");
      }

      setResendStatus("requested");
    } catch {
      setResendStatus("failed");
    } finally {
      setResendLoading(false);
    }
  };
  if (signupComplete) {
    return (
      <AuthLayout
        variant="signup"
        eyebrow="ACCOUNT VERIFICATION"
        title="Check your company email"
        description="Your workspace has been created. Verify your company email before signing in."
        asideTitle="One final step."
        asideDescription="Confirm your organization email to protect your workspace and complete account setup."
        features={[
          "A dedicated workspace for your organization",
          "A 14-day trial with up to 10 documents",
          "Secure sign-in after company email verification",
        ]}
        footer={
          <p className="text-center text-sm text-slate-500">
            Already verified?{" "}
            <Link
              href="/login"
              className="font-semibold text-indigo-700 transition hover:text-indigo-900"
            >
              Sign in
            </Link>
          </p>
        }
      >
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6"
            >
              <path
                d="M3.5 6.5h17v11h-17zM4 7l8 6 8-6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h2 className="text-base font-semibold text-slate-900">
            {verificationEmailSent
              ? "Verification email sent"
              : "Your workspace is ready, but the email could not be sent"}
          </h2>

          <p className="mt-2 break-words text-sm font-medium text-slate-700">
            {companyEmail.trim()}
          </p>

          {verificationEmailSent ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Open the message and follow its verification link. Check your
              spam or junk folder if it does not arrive. You can sign in after
              your company email has been verified.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your workspace has been created, but we could not deliver the
              verification message. Please contact support for assistance
              before attempting to sign in.
            </p>
          )}
        </div>

        {resendStatus === "requested" && (
          <p role="status" className="mt-4 text-sm leading-6 text-emerald-700">
            Request received. If this workspace needs verification, a new
            message may arrive shortly. Check your spam or junk folder too.
          </p>
        )}

        {resendStatus === "failed" && (
          <p role="alert" className="mt-4 text-sm leading-6 text-rose-700">
            We could not process your request. Please try again shortly.
          </p>
        )}

        <button
          type="button"
          onClick={handleResendVerification}
          disabled={resendLoading}
          className="mt-4 flex w-full items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resendLoading ? "Requesting verification email..." : "Resend verification email"}
        </button>

        <Link
          href="/login"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/10 transition hover:bg-indigo-800"
        >
          Go to sign in
          <span aria-hidden="true">→</span>
        </Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      variant="signup"
      eyebrow="GET STARTED"
      title="Your organization. One intelligent workspace."
      description="Create your organization workspace and bring greater structure, visibility, and control to your document operations."
      asideTitle="Make every document work harder."
      asideDescription="Bring records together, understand document content faster, and support consistent review and appraisal workflows from one secure workspace."
      features={[
        "A dedicated workspace for your organization",
        "AI-assisted document intelligence and appraisal workflows",
        "Structured records with clear access permissions",
      ]}
      footer={
        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-indigo-700 transition hover:text-indigo-900"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <div
        id="trial-details"
        className="mb-7 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50/70 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
            >
              <path
                d="M8 3v3m8-3v3M4.5 9h15M6.5 5h11A2.5 2.5 0 0 1 20 7.5v11A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-11A2.5 2.5 0 0 1 6.5 5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="m9 14 2 2 4-4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">
                Start with a 14-day trial
              </p>
              <span className="rounded-full border border-indigo-200 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                Included
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Get started with up to 10 documents during your 14-day
              trial, beginning when your account is created.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
            Company details
          </p>

          <label htmlFor="companyName" className={labelClassName}>
            Company or organization name
          </label>
          <input
            id="companyName"
            name="companyName"
            type="text"
            autoComplete="organization"
            required
            maxLength={255}
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className={inputClassName}
            placeholder="Enter your company name"
          />
        </div>

        <div>
          <label htmlFor="companyEmail" className={labelClassName}>
            Company email
          </label>
          <input
            id="companyEmail"
            name="companyEmail"
            type="email"
            autoComplete="organization"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={320}
            value={companyEmail}
            onChange={(event) => setCompanyEmail(event.target.value)}
            className={inputClassName}
            placeholder="contact@company.com"
          />
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Use an email address your organization can access.
          </p>
        </div>

        <div>
          <label htmlFor="industryKey" className={labelClassName}>
            Industry / Business Domain
          </label>
          <select
            id="industryKey"
            name="industryKey"
            required
            value={industryKey}
            onChange={(event) => {
              setIndustryKey(event.target.value);
              setIndustryOther("");
            }}
            className={inputClassName}
          >
            <option value="" disabled>
              Select your industry
            </option>
            {industries.map((industry) => (
              <option key={industry.value} value={industry.value}>
                {industry.label}
              </option>
            ))}
          </select>
        </div>

        {industryKey === "other_general_commercial" ? (
          <div>
            <label htmlFor="industryOther" className={labelClassName}>
              Specify your industry
            </label>
            <input
              id="industryOther"
              name="industryOther"
              type="text"
              required
              maxLength={255}
              value={industryOther}
              onChange={(event) => setIndustryOther(event.target.value)}
              className={inputClassName}
              placeholder="Enter your industry or business domain"
            />
          </div>
        ) : null}

        <div className="border-t border-slate-100 pt-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
            Workspace owner
          </p>

          <label htmlFor="fullName" className={labelClassName}>
            Owner full name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            required
            maxLength={255}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={inputClassName}
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClassName}>
            Owner work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={320}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClassName}
            placeholder="you@company.com"
          />
          <p className="mt-2 text-xs leading-5 text-slate-400">
            This email will be used for your workspace account.
          </p>
        </div>

        <div>
          <label htmlFor="jobPosition" className={labelClassName}>
            Job position
          </label>
          <select
            id="jobPosition"
            name="jobPosition"
            required
            value={jobPosition}
            onChange={(event) => {
              setJobPosition(event.target.value);
              setJobTitleOther("");
            }}
            className={inputClassName}
          >
            <option value="" disabled>
              Select your position
            </option>
            {jobPositions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </div>

        {jobPosition === "Other" ? (
          <div>
            <label htmlFor="jobTitleOther" className={labelClassName}>
              Specify your job title
            </label>
            <input
              id="jobTitleOther"
              name="jobTitleOther"
              type="text"
              required
              maxLength={255}
              value={jobTitleOther}
              onChange={(event) => setJobTitleOther(event.target.value)}
              className={inputClassName}
              placeholder="Enter your job title"
            />
          </div>
        ) : null}

        <div className="border-t border-slate-100 pt-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
            Secure your account
          </p>

          <label htmlFor="password" className={labelClassName}>
            Create password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClassName}
            placeholder="At least 8 characters"
          />
          <p className="mt-2 text-xs text-slate-400">
            Use at least 8 characters.
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className={labelClassName}>
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={inputClassName}
            placeholder="Enter your password again"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <label
            htmlFor="termsAccepted"
            className="flex cursor-pointer items-start gap-3"
          >
            <input
              id="termsAccepted"
              name="termsAccepted"
              type="checkbox"
              required
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-700 focus:ring-indigo-500"
            />
            <span className="text-sm leading-6 text-slate-700">
              I agree to the platform's terms and privacy policy and
              confirm that I am authorized to create this organization
              workspace.
            </span>
          </label>
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
          {loading ? (
            <>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4 animate-spin"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeOpacity=".3"
                  strokeWidth="3"
                />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Creating your workspace...
            </>
          ) : (
            <>
              Create account
              <span aria-hidden="true">→</span>
            </>
          )}
        </button>

        <p className="text-center text-xs leading-5 text-slate-400">
          Creating an account sets up a new organization workspace with
          an owner membership and a 14-day trial for up to 10 documents.
        </p>
      </form>
    </AuthLayout>
  );
}
