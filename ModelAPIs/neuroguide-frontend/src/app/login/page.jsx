"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../../components/navbar";
import Sidebar from "../../components/Sidebar";
import { apiFetch, saveTokens } from "../../lib/api";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const tokens = await apiFetch("login/", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
        }),
      });
      saveTokens(tokens);
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/";
      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f0f0] text-[#292929]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar />

        <main className="flex min-w-0 flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <section className="w-full max-w-md rounded-xl border border-[#c5c5c5] bg-white p-6 sm:p-8">
            <div className="mb-7 text-center">
              <h1 className="text-2xl font-bold tracking-wide">Welcome back</h1>
              <p className="mt-2 text-sm text-[#666]">
                Sign in to continue to NeuroGuide.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="block text-sm font-semibold text-[#383838]"
                >
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  autoComplete="username"
                  required
                  className="w-full rounded-md border border-[#bdbdbd] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#666] focus:ring-2 focus:ring-[#666]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-[#383838]"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-md border border-[#bdbdbd] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#666] focus:ring-2 focus:ring-[#666]/20"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md border border-[#333] bg-[#333] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4a4a4a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
              >
                  {isSubmitting ? "Signing in…" : "Sign in"}
              </button>
              {error ? (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              ) : null}
            </form>

            <p className="mt-6 text-center text-sm text-[#666]">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-semibold text-[#292929] underline underline-offset-4 hover:text-[#666]"
              >
                Create one
              </Link>
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
