"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import RecoverySetupModal from "@/components/RecoverySetupModal";

// ----------------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------------
interface NewsItem {
  id: string;
  title: string;
  summary: string;
  date: string;
  imageUrl?: string;
  createdAtSeconds?: number;
}

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

// ----------------------------------------------------------------------
// アイコンコンポーネント
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// メインページ コンポーネント
// ----------------------------------------------------------------------
export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ニュース一覧 State
  const [newsList, setNewsList] = useState<NewsItem[]>([]);

  // アカウント保護ポップアップの表示フラグ
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // トースト通知 State
  const [toasts, setToasts] = useState<Toast[]>([]);

  const router = useRouter();

  // トースト通知追加関数
  const addToast = (type: "success" | "error" | "info", message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  // 1. URLクエリの検知 (Discord連携成功/エラーのトースト表示)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const linked = params.get("discord_linked");

    if (error === "discord_already_linked") {
      addToast(
        "error",
        "⚠️ このDiscordアカウントは、すでに別のYellstarユーザーに連携されています！"
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      addToast("error", "❌ Discord連携処理中にエラーが発生しました。");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (linked === "true") {
      addToast("success", "🎉 Discordアカウントの連携が正常に完了しました！");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // 2. 認証 & Firestore監視
  useEffect(() => {
    // ログイン認証の監視
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // ユーザーの復旧設定（hasConfiguredRecovery）を確認
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            if (!userData.hasConfiguredRecovery) {
              setShowRecoveryModal(true);
            }
          } else {
            setShowRecoveryModal(true);
          }
        } catch (err) {
          console.error("ユーザーデータ取得エラー:", err);
        }
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    // Firestoreから「公開中(isPublished: true)」の記事をリアルタイム取得
    const articlesQuery = query(
      collection(db, "articles"),
      where("isPublished", "==", true)
    );

    const unsubscribeArticles = onSnapshot(articlesQuery, (snapshot) => {
      const fetchedNews: NewsItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        const dateStr = data.createdAt?.seconds
          ? new Date(data.createdAt.seconds * 1000).toLocaleDateString("ja-JP")
          : "----/--/--";

        return {
          id: docSnap.id,
          title: data.title,
          summary: data.summary,
          date: dateStr,
          imageUrl: data.imageUrl,
          createdAtSeconds: data.createdAt?.seconds || 0,
        };
      });

      // 新しい順（降順）にソート
      fetchedNews.sort(
        (a, b) => (b.createdAtSeconds || 0) - (a.createdAtSeconds || 0)
      );

      setNewsList(fetchedNews);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeArticles();
    };
  }, [router]);

  // ログアウト処理
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  // ユーザー表示名
  const getUserName = () => {
    if (!user) return "ゲスト";
    if (user.displayName) return user.displayName;
    if (user.email) return user.email.split("@")[0];
    return "ユーザー";
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/40">
        <div className="relative flex items-center justify-center">
          <div className="h-14 w-14 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          <StarIcon className="absolute h-5 w-5 text-amber-400 animate-pulse" />
        </div>
        <p className="mt-4 text-xs font-bold tracking-widest text-indigo-900/60 uppercase">
          Loading Yellstar...
        </p>
      </main>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100 text-slate-900 overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      {/* トースト通知オーバーレイ */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border backdrop-blur-2xl shadow-xl shadow-slate-900/5 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300 text-xs font-bold ${
              toast.type === "error"
                ? "bg-rose-500/10 border-rose-200 text-rose-800"
                : toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-200 text-emerald-800"
                : "bg-indigo-500/10 border-indigo-200 text-indigo-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">
                {toast.type === "error" ? "⚠️" : toast.type === "success" ? "✨" : "ℹ️"}
              </span>
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
              className="text-slate-400 hover:text-slate-700 transition"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* 復旧設定未完了時のポップアップモーダル */}
      {showRecoveryModal && user && (
        <RecoverySetupModal
          userId={user.uid}
          onComplete={() => setShowRecoveryModal(false)}
        />
      )}

      {/* 背景光彩グラデーション装飾 */}
      <div className="pointer-events-none fixed -z-10 inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-indigo-300/30 via-purple-300/20 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -left-48 h-[450px] w-[450px] rounded-full bg-gradient-to-br from-amber-200/30 to-indigo-200/20 blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 h-[400px] w-[400px] rounded-full bg-indigo-200/20 blur-3xl" />
      </div>

      {/* ヘッダー */}
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur-2xl transition-all">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-xl font-black tracking-tight group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20 transition-transform duration-300 group-hover:scale-105">
              <StarIcon className="h-4 w-4 text-amber-300" />
            </div>
            <div className="flex items-center">
              <span className="text-slate-900 font-extrabold">Yell</span>
              <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent font-black">
                star
              </span>
            </div>
          </a>

          <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-bold text-slate-600">
            <a
              href="/"
              className="text-indigo-600 font-extrabold relative py-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-indigo-600 after:rounded-full"
            >
              ホーム
            </a>

            <a
              href="/profile"
              className="hover:text-indigo-600 transition-colors flex items-center gap-1.5 py-1"
            >
              <span className="text-sm">⚙️</span>
              <span className="hidden sm:inline">プロフィール設定</span>
            </a>

            <a
              href="/mailbox"
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-1.5 text-white shadow-md shadow-indigo-500/25 transition duration-300 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/35 active:scale-95"
            >
              <span className="text-xs">✉️</span>
              <span className="hidden sm:inline font-bold">メール</span>
            </a>

            <button
              onClick={handleLogout}
              className="text-slate-400 transition-colors hover:text-rose-500 py-1 font-medium"
            >
              ログアウト
            </button>
          </nav>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-6 py-8 sm:py-12 space-y-10">
        {/* ウェルカムヒーローバナー */}
        <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-7 sm:p-9 shadow-[0_10px_40px_rgba(79,70,229,0.06)] backdrop-blur-2xl transition-all">
          <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-400/20 via-purple-300/20 to-amber-200/20 blur-3xl" />
          
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] font-black uppercase tracking-wider text-indigo-600">
                <StarIcon className="h-3 w-3 text-amber-400" />
                <span>Dashboard Overview</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                おかえりなさい、<span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{getUserName()}</span> さん
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                Yellstarの最新お知らせやアカウントの状態をチェックできます。
              </p>
            </div>

            {/* アカウントQuick情報バッジ */}
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="/profile"
                className="inline-flex items-center gap-1.5 rounded-2xl border border-indigo-200/80 bg-indigo-50/80 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100/80 transition duration-200 shadow-sm"
              >
                <span>✏️</span> 名前を変更する
              </a>

              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-2 font-mono text-xs text-slate-600 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-slate-400">ID:</span>
                <span className="font-bold">{user?.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ニュース一覧セクション */}
        <section id="news" className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600 shadow-sm border border-indigo-100">
                <span className="text-lg">📰</span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  最新ニュース＆お知らせ
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  運営からの重要なアナウンス一覧
                </p>
              </div>
            </div>

            <span className="rounded-full bg-slate-200/60 px-3 py-1 font-mono text-xs font-bold text-slate-600">
              全 {newsList.length} 件
            </span>
          </div>

          {newsList.length === 0 ? (
            <div className="rounded-3xl border border-white/80 bg-white/50 p-12 sm:p-16 text-center backdrop-blur-2xl shadow-sm space-y-3">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 border border-indigo-100 text-3xl shadow-inner">
                📢
              </div>
              <p className="text-base font-extrabold text-slate-700">
                現在表示できる最新ニュースはありません
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                エディター画面から新しい記事を投稿・公開すると、ここに即座に反映されます。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {newsList.map((item) => (
                <a
                  key={item.id}
                  href={`/news/${item.id}`}
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/70 shadow-sm backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-500/10"
                >
                  {item.imageUrl ? (
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/10 to-transparent opacity-80" />
                      <span className="absolute bottom-3 left-3 rounded-xl bg-black/40 px-3 py-1 font-mono text-[10px] font-bold text-white backdrop-blur-md border border-white/20">
                        📅 {item.date}
                      </span>
                    </div>
                  ) : (
                    <div className="relative aspect-[16/6] w-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-4 flex items-end">
                      <span className="rounded-xl bg-white/60 px-3 py-1 font-mono text-[10px] font-bold text-slate-600 backdrop-blur-md border border-white/40">
                        📅 {item.date}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-1 flex-col justify-between gap-4 p-6">
                    <div className="space-y-2">
                      <h3 className="line-clamp-2 text-base font-extrabold text-slate-900 transition-colors group-hover:text-indigo-600 leading-snug">
                        {item.title}
                      </h3>
                      <p className="line-clamp-3 text-xs leading-relaxed text-slate-500 font-normal">
                        {item.summary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        NEWS Article
                      </span>
                      <div className="flex items-center gap-1 text-xs font-bold text-indigo-600">
                        <span>詳しく見る</span>
                        <span className="transition-transform duration-300 group-hover:translate-x-1">
                          →
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}