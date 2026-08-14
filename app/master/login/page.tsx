"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function MasterLoginPage() {
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
      : `${accountName.trim()}@yellstarmaster.local`;

    // 厳重チェック：@yellstarmaster.local 以外は完全拒絶！
    if (!fullEmail.endsWith("@yellstarmaster.local")) {
      setError("⛔️ アクセス制限：マスター管理者権限のあるアカウントのみログイン可能です。");
      setSubmitting(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, fullEmail, password);
      alert("マスター権限を認証しました。管理コンソールへ移動します。");
      router.push("/master");
    } catch (err: any) {
      console.error("マスター認証エラー:", err);
      setError("認証失敗: 資格情報が無効です。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      {/* 背景のレッド〜パープルグラデーション（厳重な雰囲気） */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-red-900/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-900/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-red-900/40 bg-slate-900/90 p-8 shadow-[0_0_50px_rgba(220,38,38,0.15)] backdrop-blur-2xl">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-black tracking-widest text-red-400 border border-red-500/30">
            🛡️ MASTER CONSOLE
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">最高管理者ログイン</h1>
          <p className="mt-1 text-xs font-mono text-slate-400">
            Authorized Personnel Only
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/50 bg-red-950/50 p-3.5 text-xs font-bold text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
              マスター ID
            </label>
            <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-700 bg-slate-950/80 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500">
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
                className="w-full bg-transparent p-3 font-mono text-sm text-white placeholder-slate-600 focus:outline-none"
                placeholder="root_admin"
              />
              <span className="flex items-center bg-slate-800/80 px-3 font-mono text-xs font-bold text-red-400">
                @yellstarmaster.local
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
              セキュリティパスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-3 font-mono text-sm text-white placeholder-slate-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-red-600 to-indigo-600 py-3.5 font-bold text-white shadow-lg shadow-red-900/30 transition hover:from-red-500 hover:to-indigo-500 disabled:opacity-50"
          >
            {submitting ? "安全に認証中..." : "システムへアクセス"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800 pt-4 text-center text-[11px] text-slate-500">
          IPアドレスおよびアクセスログは暗号化して記録されています
        </div>
      </div>
    </main>
  );
}