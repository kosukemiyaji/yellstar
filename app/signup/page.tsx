"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.5 1.6 6.7L12 16.9l-5.9 3.7 1.6-6.7-5.2-4.5 6.8-.6L12 2.5z" />
    </svg>
  );
}

export default function SignupPage() {
  const [name, setName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const generatedEmail = `${accountName.trim()}@yellstar.local`;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        generatedEmail,
        password
      );

      await updateProfile(userCredential.user, {
        displayName: name,
      });

      alert(`登録が完了しました！\nお名前: ${name}\nID: ${generatedEmail}`);
      router.push("/");
    } catch (err: any) {
      console.error("エラーの詳細:", err);

      if (err.code === "auth/email-already-in-use") {
        setError("そのアカウント名は既に使用されています。別のIDを試してください。");
      } else if (err.code === "auth/weak-password") {
        setError("パスワードが弱すぎます。英字と数字を組み合わせた6文字以上にしてください。");
      } else if (err.code === "auth/invalid-email") {
        setError("アカウントIDに使用できない文字が含まれています（半角英数字で入力してください）。");
      } else {
        setError(`登録エラー: ${err.message || "エラーが発生しました"}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 p-6">
      {/* 背景の装飾ブラー */}
      <div className="pointer-events-none fixed -z-10 inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute bottom-0 -left-32 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-8 shadow-[0_8px_40px_rgba(79,70,229,0.12)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-400/20 to-amber-300/20 blur-2xl" />

        {/* ロゴ */}
        <div className="relative mb-2 flex items-center justify-center gap-1.5 text-2xl font-black tracking-tight">
          <StarIcon className="h-5 w-5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
          <span className="text-slate-900">Yell</span>
          <span className="bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">
            star
          </span>
        </div>
        <p className="relative mb-8 text-center text-xs font-bold uppercase tracking-widest text-indigo-600">
          Create your account
        </p>

        {error && (
          <div className="relative mb-5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm font-medium text-red-700 backdrop-blur-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="relative space-y-5">
          {/* お名前入力欄 */}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">
              お名前（フルネーム）
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white/80 p-3 font-medium text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder="山田 太郎"
            />
          </div>

          {/* アカウント名 */}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">
              希望のアカウントID (半角英数)
            </label>
            <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white/80 transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/30">
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
                className="w-full bg-transparent p-3 font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
                placeholder="yamada123"
              />
              <span className="flex items-center whitespace-nowrap bg-slate-100/80 px-3 text-sm font-bold text-slate-500">
                @yellstar.local
              </span>
            </div>
          </div>

          {/* パスワード入力欄 */}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">
              パスワード (6文字以上)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-slate-200 bg-white/80 p-3 font-medium text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-base font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 hover:shadow-xl hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <StarIcon className="h-4 w-4 text-amber-300 transition-transform group-hover:rotate-12" />
            {submitting ? "作成中..." : "アカウントを作成する"}
          </button>
        </form>

        {/* ログイン画面への誘導リンク */}
        <div className="relative mt-6 border-t border-slate-200/70 pt-4 text-center">
          <p className="text-sm font-medium text-slate-500">
            すでにアカウントをお持ちの方は{" "}
            <a
              href="/login"
              className="font-bold text-indigo-600 hover:underline"
            >
              ログインはこちら
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}