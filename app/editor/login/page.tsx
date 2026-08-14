"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function EditorLoginPage() {
  const [accountName, setAccountName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const fullEmail = accountName.includes("@")
      ? accountName.trim()
      : `${accountName.trim()}@yellstareditor.local`;

    const isEditor = fullEmail.endsWith("@yellstareditor.local");
    const isMaster = fullEmail.endsWith("@yellstarmaster.local");

    if (!isEditor && !isMaster) {
      setError("エディター（@yellstareditor.local）またはマスター権限が必要です。");
      setSubmitting(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, fullEmail, password);
      alert("エディターエリアへログインしました！");
      router.push("/editor");
    } catch (err: any) {
      console.error("エディターログインエラー:", err);
      setError("アカウントIDまたはパスワードが正しくありません。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-900 p-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-800/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 text-center">
          <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-400/20">
            Editor Space
          </span>
          <h1 className="mt-3 text-2xl font-black">Yellstar エディターログイン</h1>
          <p className="mt-1 text-xs text-slate-400">
            記事の編集・管理には専用権限が必要です
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-300">
              エディターID / メールアドレス
            </label>
            <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
                className="w-full bg-transparent p-3 text-white placeholder-slate-500 focus:outline-none"
                placeholder="editor_name"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-300">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder-slate-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-amber-500 py-3 font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? "認証中..." : "エディターとしてログイン"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-700/60 pt-4 text-center text-xs text-slate-400">
          エディター権限をお持ちでない方はディスコードから運営事務局へ申請してください。
        </div>
      </div>
    </main>
  );
}