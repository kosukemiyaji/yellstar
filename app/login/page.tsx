"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.5 1.6 6.7L12 16.9l-5.9 3.7 1.6-6.7-5.2-4.5 6.8-.6L12 2.5z" />
    </svg>
  );
}

function DiscordIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 127.14 96.36" fill="currentColor" className={className}>
      <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.68 1.76 1.36 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.91-72.15zM42.45 65.69c-6.22 0-11.35-5.72-11.35-12.72s5.02-12.72 11.35-12.72c6.38 0 11.45 5.77 11.35 12.72 0 7-4.98 12.72-11.35 12.72zm42.24 0c-6.22 0-11.35-5.72-11.35-12.72s5.02-12.72 11.35-12.72c6.37 0 11.45 5.77 11.35 12.72 0 7-4.98 12.72-11.35 12.72z" />
    </svg>
  );
}

export default function LoginPage() {
  const [accountName, setAccountName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // パスワードリセット用 State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSending, setResetSending] = useState(false);

  const router = useRouter();

  // ログイン処理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    // @ が含まれていなければデフォルトで @yellstar.local を補完
    const fullEmail = accountName.includes("@")
      ? accountName.trim()
      : `${accountName.trim()}@yellstar.local`;

    try {
      await signInWithEmailAndPassword(auth, fullEmail, password);
      alert("ログインに成功しました！");
      router.push("/");
    } catch (err: any) {
      console.error("ログインエラー:", err);
      setError("アカウントIDまたはパスワードが正しくありません。");
    } finally {
      setSubmitting(false);
    }
  };

  // 標準メールアドレス宛のパスワード再設定送信処理
  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage("");
    setResetError("");
    setResetSending(true);

    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetMessage(
        "再設定用のメールを送信しました！メールの指示に従ってパスワードを再設定してください。"
      );
      setResetEmail("");
    } catch (err: any) {
      console.error("リセットメール送信エラー:", err);
      setResetError("メールの送信に失敗しました。アドレスに間違いがないかご確認ください。");
    } finally {
      setResetSending(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 p-6">
      {/* 背景装飾 */}
      <div className="pointer-events-none fixed -z-10 inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute bottom-0 -right-32 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-8 shadow-[0_8px_40px_rgba(79,70,229,0.12)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-400/20 to-amber-300/20 blur-2xl" />

        <div className="relative mb-2 flex items-center justify-center gap-1.5 text-2xl font-black tracking-tight">
          <StarIcon className="h-5 w-5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
          <span className="text-slate-900">Yell</span>
          <span className="bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">
            star
          </span>
        </div>
        <p className="relative mb-8 text-center text-xs font-bold uppercase tracking-widest text-indigo-600">
          Welcome back
        </p>

        {error && (
          <div className="relative mb-5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm font-medium text-red-700 backdrop-blur-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="relative space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">
              アカウントID / メールアドレス
            </label>
            <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white/80 transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/30">
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
                className="w-full bg-transparent p-3 font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
                placeholder="yamada123（または完全なメールアドレス）"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">
                パスワード
              </label>
              {/* 🔑 パスワードをお忘れの方 リンク */}
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(true);
                  setResetMessage("");
                  setResetError("");
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-500 hover:underline transition"
              >
                パスワードをお忘れの方
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
            {submitting ? "ログイン中..." : "ログインする"}
          </button>
        </form>

        <div className="relative mt-6 border-t border-slate-200/70 pt-4 text-center">
          <p className="text-sm font-medium text-slate-500">
            アカウントをお持ちでない方は{" "}
            <a
              href="/signup"
              className="font-bold text-indigo-600 hover:underline"
            >
              新規登録はこちら
            </a>
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 🔑 パスワード再設定 モーダル */}
      {/* ---------------------------------------------------------------------- */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/80 bg-white/90 p-7 shadow-2xl backdrop-blur-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔑</span>
                <h3 className="font-extrabold text-slate-900 text-base">
                  パスワードの再設定
                </h3>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {/* パターン1: Discord Bot経由の案内 */}
            <div className="rounded-2xl bg-[#5865F2]/10 border border-[#5865F2]/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-[#5865F2] font-extrabold text-xs">
                <DiscordIcon className="h-4 w-4" />
                <span>Discord連携済みの方</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Discordサーバー内で <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-indigo-600 border border-[#5865F2]/20">/reset-password</code> コマンドを実行すると、即座に再設定リンクが発行されます。
              </p>
            </div>

            <div className="relative text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative bg-white/90 px-3 text-[10px] font-bold text-slate-400 uppercase">
                または登録メールで受領
              </span>
            </div>

            {/* パターン2: メールアドレス宛の送信フォーム */}
            <form onSubmit={handleSendResetEmail} className="space-y-3">
              {resetMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                  {resetMessage}
                </div>
              )}
              {resetError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                  {resetError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  復旧用メールアドレス (Gmail等)
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  placeholder="example@gmail.com"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={resetSending}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-500 shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                {resetSending ? "送信中..." : "再設定リンクを送信する"}
              </button>
            </form>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 transition"
              >
                キャンセルして戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}