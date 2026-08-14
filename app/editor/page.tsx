"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface Article {
  id: string;
  title: string;
  summary: string;
  body: string;
  imageUrl: string;
  authorEmail: string;
  authorName: string;
  isPublished: boolean;
  createdAt: any;
}

export default function EditorDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);

  // フォーム用State
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 編集モード管理
  const [editingId, setEditingId] = useState<string | null>(null);

  const router = useRouter();

  // 1. 権限チェック & 記事一覧のリアルタイム監視
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // エディター権限（またはマスター権限）の確認
        const isEditor =
          currentUser.email?.endsWith("@yellstareditor.local") ||
          currentUser.email?.endsWith("@yellstarmaster.local");

        if (!isEditor) {
          alert("⛔️ アクセス拒否：エディター権限がありません。");
          router.push("/");
          return;
        }

        setUser(currentUser);

        // Firestoreから全記事をリアルタイム取得
        const articlesQuery = query(collection(db, "articles"));
        const unsubscribeArticles = onSnapshot(articlesQuery, (snapshot) => {
          const fetchedArticles: Article[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Article, "id">),
          }));

          // 作成日時の新しい順にソート
          fetchedArticles.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });

          setArticles(fetchedArticles);
        });

        setLoading(false);

        return () => unsubscribeArticles();
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  // 2. 記事の新規保存・更新処理
  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;

    setSubmitting(true);

    try {
      if (editingId) {
        // --- 記事の更新 ---
        const articleRef = doc(db, "articles", editingId);
        await updateDoc(articleRef, {
          title: title.trim(),
          summary: summary.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim(),
          isPublished,
        });
        alert("記事を更新しました！");
      } else {
        // --- 新規記事の投稿 ---
        await addDoc(collection(db, "articles"), {
          title: title.trim(),
          summary: summary.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim() || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop",
          authorEmail: user.email,
          authorName: user.displayName || user.email?.split("@")[0] || "エディター",
          isPublished,
          createdAt: serverTimestamp(),
        });
        alert("記事を保存しました！");
      }

      resetForm();
    } catch (err: any) {
      console.error("記事保存エラー:", err);
      alert("保存に失敗しました: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 3. 編集モードに入る
  const startEdit = (article: Article) => {
    setEditingId(article.id);
    setTitle(article.title);
    setSummary(article.summary);
    setBody(article.body || "");
    setImageUrl(article.imageUrl || "");
    setIsPublished(article.isPublished);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 4. フォームのリセット
  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setSummary("");
    setBody("");
    setImageUrl("");
    setIsPublished(true);
  };

  // 5. 公開ステータスの切り替え
  const togglePublish = async (article: Article) => {
    try {
      const articleRef = doc(db, "articles", article.id);
      await updateDoc(articleRef, {
        isPublished: !article.isPublished,
      });
    } catch (err) {
      console.error("ステータス変更エラー:", err);
    }
  };

  // 6. 記事の削除
  const handleDelete = async (id: string) => {
    if (confirm("この記事を完全に削除しますか？")) {
      try {
        await deleteDoc(doc(db, "articles", id));
        alert("記事を削除しました。");
      } catch (err) {
        console.error("削除エラー:", err);
      }
    }
  };

  // 日時表示用
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "保存中...";
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleDateString("ja-JP");
    }
    return "----/--/--";
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-indigo-400 font-mono">
        Authenticating Editor Authorization...
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* ヘッダー */}
      <header className="border-b border-indigo-900/40 bg-slate-900/90 sticky top-0 z-50 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-xl tracking-widest text-indigo-400">Yellstar</span>
            <span className="rounded border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-300">
              EDITOR STUDIO
            </span>
          </div>
          <span className="font-mono text-xs text-slate-400">{user?.email}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左側: 記事作成・編集フォーム (5カラム) */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 h-fit sticky top-24">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base text-white">
              {editingId ? "✏️ 記事の編集" : "📝 新規記事作成"}
            </h2>
            {editingId && (
              <button
                onClick={resetForm}
                className="text-xs text-indigo-400 hover:underline font-bold"
              >
                新規作成に戻る
              </button>
            )}
          </div>

          <form onSubmit={handleSaveArticle} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">タイトル</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="例: 新機能リリースのお知らせ"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">概要・サマリー</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
                rows={2}
                placeholder="一覧画面に表示される短めの説明文..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">本文</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="詳細な本文を入力..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">アイキャッチ画像URL (任意)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isPublished"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-0"
              />
              <label htmlFor="isPublished" className="text-xs font-bold text-slate-300 cursor-pointer">
                すぐに全体公開する
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 rounded-xl transition shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {submitting ? "保存中..." : editingId ? "記事を更新する" : "記事を保存・投稿する"}
            </button>
          </form>
        </div>

        {/* 右側: 記事管理リスト (7カラム) */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="font-bold text-base text-slate-300">📰 投稿記事一覧 ({articles.length}件)</h2>

          {articles.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
              まだ投稿された記事はありません。
            </div>
          ) : (
            articles.map((art) => (
              <div
                key={art.id}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex gap-4 items-center justify-between hover:border-slate-700 transition"
              >
                <div className="flex gap-4 items-center flex-1 min-w-0">
                  {art.imageUrl && (
                    <img
                      src={art.imageUrl}
                      alt={art.title}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-800 flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePublish(art)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          art.isPublished
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {art.isPublished ? "● 公開中" : "○ 下書き"}
                      </button>
                      <span className="font-mono text-[10px] text-slate-500">{formatDate(art.createdAt)}</span>
                    </div>
                    <h3 className="font-bold text-sm text-white truncate">{art.title}</h3>
                    <p className="text-xs text-slate-400 truncate">{art.summary}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0 pl-2">
                  <button
                    onClick={() => startEdit(art)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold bg-indigo-950/40 border border-indigo-900/50 px-3 py-1.5 rounded-lg transition"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(art.id)}
                    className="text-xs text-red-400 hover:text-red-300 font-bold bg-red-950/40 border border-red-900/50 px-3 py-1.5 rounded-lg transition"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </main>
    </div>
  );
}