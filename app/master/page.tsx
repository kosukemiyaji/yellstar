"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface BannedUser {
  email: string;
  bannedAt: any;
}

export default function MasterDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [processing, setProcessing] = useState(false);

  const router = useRouter();

  const ADMIN_DOMAIN = "@yellstarmaster.local";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.email) {
        setUser(currentUser);

        // マスタードメインの検証
        if (currentUser.email.endsWith(ADMIN_DOMAIN)) {
          setIsAdmin(true);
          await fetchBannedUsers();
        } else {
          setIsAdmin(false);
          router.push("/master/login");
        }
        setLoading(false);
      } else {
        router.push("/master/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // BAN済みユーザー一覧の取得
  const fetchBannedUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "bannedUsers"));
      const list: BannedUser[] = querySnapshot.docs.map((docSnap) => ({
        email: docSnap.id,
        ...(docSnap.data() as Omit<BannedUser, "email">),
      }));
      setBannedUsers(list);
    } catch (error) {
      console.error("BANリスト取得エラー:", error);
    }
  };

  // ユーザーをBANする処理
  const handleBanUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToBan = targetEmail.trim().toLowerCase();
    if (!emailToBan || processing) return;

    if (emailToBan.endsWith(ADMIN_DOMAIN)) {
      alert("⛔️ マスター権限を持つアカウントはBANできません。");
      return;
    }

    if (!confirm(`本当に ${emailToBan} をBANしますか？`)) return;

    setProcessing(true);
    try {
      await setDoc(doc(db, "bannedUsers", emailToBan), {
        bannedAt: serverTimestamp(),
        banned: true,
      });

      alert(`${emailToBan} をBANしました。`);
      setTargetEmail("");
      await fetchBannedUsers();
    } catch (error: any) {
      console.error("BAN処理エラー:", error);
      alert("エラーが発生しました: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  // BANを解除する処理
  const handleUnbanUser = async (email: string) => {
    if (!confirm(`${email} のBANを解除しますか？`)) return;

    setProcessing(true);
    try {
      await setDoc(doc(db, "bannedUsers", email), { banned: false });
      alert(`${email} のBANを解除しました。`);
      await fetchBannedUsers();
    } catch (error: any) {
      console.error("BAN解除エラー:", error);
      alert("エラーが発生しました: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 font-mono text-xs text-slate-500">
        認証セッションを検証中...
      </main>
    );
  }

  if (!isAdmin) {
    return null; // リダイレクト中のチラつき防止
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* 背景のグラデーション演出 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-red-950/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-950/20 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-red-900/30 bg-slate-900/60 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="rounded-full bg-red-500/10 p-2 text-sm border border-red-500/30">🛡️</span>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white">Yellstar 最高管理コンソール</h1>
              <p className="font-mono text-[10px] text-red-400">LOGGED IN: {user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/mailbox")}
            className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            メールボックスへ戻る
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl space-y-8 px-6 py-8">
        {/* BAN実行セクション */}
        <div className="rounded-3xl border border-red-900/40 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-2xl">
          <h2 className="mb-4 text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-2">
            <span>🚫</span> ユーザー利用停止 (BAN) 管理
          </h2>
          <form onSubmit={handleBanUser} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-400">
                ターゲット・メールアドレス
              </label>
              <input
                type="email"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                required
                placeholder="user@example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-3 font-mono text-xs text-white placeholder:text-slate-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={processing}
              className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-red-900/30 transition hover:from-red-500 hover:to-red-600 disabled:opacity-50"
            >
              {processing ? "処理を実行中..." : "このアカウントをBANする"}
            </motion.button>
          </form>
        </div>

        {/* BAN済みアカウント一覧 */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-2xl">
          <h2 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <span>📋</span> BAN済みアカウント一覧
          </h2>
          {bannedUsers.length === 0 ? (
            <p className="py-6 text-center font-mono text-xs text-slate-500">
              現在、BANされているアカウントはありません。
            </p>
          ) : (
            <div className="space-y-2.5">
              {bannedUsers.map((b) => (
                <div
                  key={b.email}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs"
                >
                  <span className="font-mono text-red-300">{b.email}</span>
                  <button
                    onClick={() => handleUnbanUser(b.email)}
                    disabled={processing}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-bold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    解除する
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}