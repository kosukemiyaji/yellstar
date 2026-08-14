"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ArticleDetail {
  id: string;
  title: string;
  summary: string;
  body: string;
  imageUrl?: string;
  authorName?: string;
  createdAt?: any;
}

function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.5 1.6 6.7L12 16.9l-5.9 3.7 1.6-6.7-5.2-4.5 6.8-.6L12 2.5z" />
    </svg>
  );
}

export default function NewsDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchArticle = async () => {
      try {
        const docRef = doc(db, "articles", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setArticle({
            id: docSnap.id,
            ...(docSnap.data() as Omit<ArticleDetail, "id">),
          });
        } else {
          console.error("記事が見つかりませんでした");
        }
      } catch (error) {
        console.error("記事取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleDateString("ja-JP");
    }
    return "";
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-slate-500 text-sm font-semibold">記事を読み込み中...</p>
        </div>
      </main>
    );
  }

  if (!article) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6">
        <div className="text-center space-y-4">
          <p className="text-4xl">🔍</p>
          <h1 className="text-xl font-bold text-slate-800">お探しの記事は見つかりませんでした</h1>
          <p className="text-xs text-slate-500">すでに削除されたか、URLが間違っている可能性があります。</p>
          <button
            onClick={() => router.push("/")}
            className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-indigo-500"
          >
            ← ホームに戻る
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 text-slate-900">
      {/* 背景装飾 */}
      <div className="pointer-events-none fixed -z-10 inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      {/* ヘッダー */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 transition"
          >
            ← ニュース一覧に戻る
          </button>
          <div className="flex items-center gap-1 text-base font-black">
            <StarIcon className="h-4 w-4 text-amber-400" />
            <span>Yellstar News</span>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        <article className="overflow-hidden rounded-3xl border border-white/80 bg-white/70 shadow-xl backdrop-blur-xl p-6 sm:p-10 space-y-8">
          {/* メタ情報 */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-600 border border-indigo-100">
                📢 お知らせ
              </span>
              <span>{formatDate(article.createdAt)}</span>
              {article.authorName && (
                <>
                  <span>•</span>
                  <span>投稿者: {article.authorName}</span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
              {article.title}
            </h1>

            <p className="text-sm font-medium text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              {article.summary}
            </p>
          </div>

          {/* アイキャッチ画像 */}
          {article.imageUrl && (
            <div className="overflow-hidden rounded-2xl border border-slate-100 max-h-96">
              <img
                src={article.imageUrl}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* 本文 */}
          <div className="text-sm sm:text-base leading-relaxed text-slate-800 whitespace-pre-wrap pt-4 border-t border-slate-100">
            {article.body || article.summary}
          </div>

          {/* 下部ナビゲーション */}
          <div className="pt-8 border-t border-slate-100 flex justify-between items-center">
            <button
              onClick={() => router.push("/")}
              className="rounded-xl bg-slate-100 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
            >
              ← 一覧に戻る
            </button>
          </div>
        </article>
      </main>
    </div>
  );
}