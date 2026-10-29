"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "../../components/navbar";
import Sidebar from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

export default function Register() {
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setCreated(false);
    setIsSubmitting(true);

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    try {
      await apiFetch("register/", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          username: formData.get("username"),
          email: formData.get("email"),
          password: formData.get("password"),
          password2: formData.get("password2"),
        }),
      });
      setCreated(true);
      formElement.reset();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f8f9] text-[#183940]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar />

        <main className="flex min-w-0 flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <section className="w-full max-w-md rounded-xl border border-[#c9dadd] bg-white p-6 sm:p-8">
            <div className="mb-7 text-center">
              <h1 className="text-2xl font-bold tracking-wide">Create your account</h1>
              <p className="mt-2 text-sm text-[#536c73]">
                Get started with NeuroGuide.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="block text-sm font-semibold text-[#304b54]"
                >
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  autoComplete="username"
                  required
                  className="w-full rounded-md border border-[#b6ccd1] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#536c73] focus:ring-2 focus:ring-[#536c73]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-[#304b54]"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  required
                  className="w-full rounded-md border border-[#b6ccd1] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#536c73] focus:ring-2 focus:ring-[#536c73]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-[#304b54]"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-md border border-[#b6ccd1] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#536c73] focus:ring-2 focus:ring-[#536c73]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-semibold text-[#304b54]"
                >
                  Confirm password
                </label>
                <input
                  type="password"
                  id="confirm-password"
                  name="password2"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-md border border-[#b6ccd1] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#536c73] focus:ring-2 focus:ring-[#536c73]/20"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 w-full rounded-md border border-[#176b5b] bg-[#176b5b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115648] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71]"
              >
                {isSubmitting ? "Creating account…" : "Create account"}
              </button>
              {error ? (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              {created ? (
                <p role="status" className="text-sm text-green-800">
                  Account created. You can now sign in.
                </p>
              ) : null}
            </form>

            <p className="mt-6 text-center text-sm text-[#536c73]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-[#183940] underline underline-offset-4 hover:text-[#536c73]"
              >
                Sign in
              </Link>
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
