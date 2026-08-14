"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setDisplayName(currentUser.displayName || currentUser.email?.split("@")[0] || "");
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSubmitting(true);

    try {
      await updateProfile(auth.currentUser, {
        displayName: displayName.trim(),
      });
      alert("プロフィール（表示名）を更新しました！");
      router.push("/");
    } catch (err: any) {
      alert("更新エラー: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        読み込み中...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/80 bg-white/70 p-8 shadow-xl backdrop-blur-xl">
        <h1 className="text-xl font-black text-slate-900 mb-1">プロフィール設定</h1>
        <p className="text-xs text-slate-500 mb-6">メイン画面に表示される名前を変更できます</p>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">表示名（ニックネーム）</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="例: たなか"
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">アカウントID（メールアドレス）</label>
            <input
              type="text"
              disabled
              value={user?.email || ""}
              className="w-full rounded-xl border border-slate-200 bg-slate-100 p-3 text-sm font-mono text-slate-400 cursor-not-allowed"
            />
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? "保存中..." : "変更を保存する"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 transition"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}