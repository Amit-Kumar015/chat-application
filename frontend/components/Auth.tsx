"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!isLogin && !username.trim()) {
      setError("Please enter your username.");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const res = await api.login(email.trim(), password);
        localStorage.setItem("token", res.access_token);
        localStorage.setItem("user", JSON.stringify(res.user));
        onAuthSuccess();
      } else {
        const res = await api.signup(username.trim(), email.trim(), password);
        localStorage.setItem("token", res.access_token);
        localStorage.setItem("user", JSON.stringify(res.user));
        onAuthSuccess();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin((prev) => !prev);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#171717] text-white flex items-center justify-center px-4 select-none">
      <div className="bg-[#212121] border border-[#333333] rounded-2xl p-8 shadow-2xl max-w-md w-full">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-[#ECECEC]">
            {isLogin ? "Welcome back" : "Create your account"}
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="johndoe"
                autoComplete="username"
                minLength={2}
                disabled={loading}
                className="w-full bg-[#171717] border border-[#383838] rounded-xl px-3.5 py-2.5 text-xs text-[#ECECEC] placeholder-[#666666] outline-none focus:border-[#666666] transition"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
              className="w-full bg-[#171717] border border-[#383838] rounded-xl px-3.5 py-2.5 text-xs text-[#ECECEC] placeholder-[#666666] outline-none focus:border-[#666666] transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={6}
              disabled={loading}
              className="w-full bg-[#171717] border border-[#383838] rounded-xl px-3.5 py-2.5 text-xs text-[#ECECEC] placeholder-[#666666] outline-none focus:border-[#666666] transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ECECEC] font-semibold text-sm py-2.5 rounded-xl hover:bg-white active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            {loading && (
              <Loader2 size={14} className="animate-spin text-[#171717]" />
            )}
            <span className="!text-[#171717] font-semibold">
              {loading
                ? "Processing..."
                : isLogin
                  ? "Sign In"
                  : "Create Account"}
            </span>
          </button>
        </form>

        <p className="text-center text-xs text-[#8E8E8E] mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={toggleAuthMode}
            className="text-[#ECECEC] font-medium hover:underline ml-1 cursor-pointer"
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
