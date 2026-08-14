"use client";

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Props {
  userId: string;
  onComplete: () => void;
}

export default function RecoverySetupModal({ userId, onComplete }: Props) {
  const [realEmail, setRealEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. 復旧用メールアドレスの保存処理
  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!realEmail) return;

    setLoading(true);
    try {
      const userRef = doc(db, "users", userId);
      await setDoc(
        userRef,
        {
          recoveryEmail: realEmail.trim(),
          hasConfiguredRecovery: true,
        },
        { merge: true }
      );

      alert("復旧用メールアドレスを登録しました！");
      onComplete();
    } catch (err: any) {
      console.error("保存エラー:", err);
      alert("保存に失敗しました: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Discord認証画面へ飛ばす処理
  const handleDiscordLink = () => {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;

    if (!clientId) {
      alert(".env.local に NEXT_PUBLIC_DISCORD_CLIENT_ID が設定されていません");
      return;
    }

    const redirectUri = encodeURIComponent("http://localhost:3000/api/auth/callback/discord");
    const scope = encodeURIComponent("identify email");

    // stateパラメータにログイン中ユーザーのUIDを入れてDiscord側へ渡す
    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&state=${userId}`;

    window.location.href = discordAuthUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h2 className="text-base font-black text-amber-400">
              アカウント保護の設定をお願いします
            </h2>
            <p className="text-[11px] text-slate-400">初回ログイン時のお手続き</p>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-slate-300">
          現在ログインで使用しているアドレスはアプリ専用のID（架空アドレス）です。<br />
          パスワードを忘れた際に復旧できるよう、<strong className="text-amber-300">「本物のメールアドレス」</strong>を登録するか、<strong className="text-indigo-300">「Discordアカウント」</strong>を連携してください。
        </p>

        {/* 復旧用メールアドレスのフォーム */}
        <form
          onSubmit={handleSaveEmail}
          className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800"
        >
          <label className="block text-xs font-bold text-slate-400">
            📧 復旧用メールアドレス (Gmail等)
          </label>
          <input
            type="email"
            value={realEmail}
            onChange={(e) => setRealEmail(e.target.value)}
            required
            placeholder="example@gmail.com"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "保存中..." : "このメールアドレスを登録する"}
          </button>
        </form>

        <div className="relative text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <span className="relative bg-slate-900 px-3 text-[10px] text-slate-500 font-bold uppercase">
            または
          </span>
        </div>

        {/* Discord連携ボタン */}
        <button
          type="button"
          onClick={handleDiscordLink}
          className="w-full rounded-xl bg-[#5865F2] hover:bg-[#4752C4] py-3 text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-lg shadow-[#5865F2]/20"
        >
          <span>💬</span> Discordと連携してアカウントを保護する
        </button>
      </div>
    </div>
  );
}