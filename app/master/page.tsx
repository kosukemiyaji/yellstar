"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

// 型定義
interface Article {
  id: number;
  title: string;
  author: string;
  isPublished: boolean;
  date: string;
}

interface Report {
  id: number;
  targetUser: string;
  reporter: string;
  reason: string;
  status: "未対応" | "対応済み";
  date: string;
}

interface Inquiry {
  id: number;
  userName: string;
  question: string;
  reply: string;
  status: "未回答" | "回答済み";
  date: string;
}

export default function MasterDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"articles" | "mail" | "reports" | "inquiries">("articles");
  const router = useRouter();

  // --- 状態管理 (ダミーデータ) ---
  // 1. 記事一覧
  const [articles, setArticles] = useState<Article[]>([
    { id: 1, title: "Yellstar 新機能リリースのお知らせ", author: "運営事務局", isPublished: true, date: "2026.08.10" },
    { id: 2, title: "コミュニティガイドラインの改定について", author: "広報部", isPublished: true, date: "2026.08.05" },
    { id: 3, title: "【下書き】裏機能の使い方", author: "editor1", isPublished: false, date: "2026.08.02" },
  ]);

  // 新規記事作成フォーム用
  const [newArticleTitle, setNewArticleTitle] = useState("");

  // 2. メール作成用
  const [mailTarget, setMailTarget] = useState("all");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");

  // 3. 通報一覧
  const [reports, setReports] = useState<Report[]>([
    { id: 1, targetUser: "user_bad_boy", reporter: "yamada123", reason: "不適切なコメントの連投", status: "未対応", date: "2026.08.12" },
    { id: 2, targetUser: "spammer007", reporter: "sato_tech", reason: "スパムリンクの貼付", status: "対応済み", date: "2026.08.11" },
  ]);

  // 4. 質問問い合わせ一覧
  const [inquiries, setInquiries] = useState<Inquiry[]>([
    { id: 1, userName: "tanaka_fan", question: "エディター申請の基準を教えてください！", reply: "", status: "未回答", date: "2026.08.13" },
    { id: 2, userName: "suzuki_star", question: "パスワードの変更方法は？", reply: "設定画面より変更可能です。", status: "回答済み", date: "2026.08.09" },
  ]);
  const [replyInputs, setReplyInputs] = useState<{ [key: number]: string }>({});

  // 権限チェック
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (!currentUser.email?.endsWith("@yellstarmaster.local")) {
          alert("⛔️ アクセス拒否：マスター管理者権限がありません。");
          router.push("/master/login");
          return;
        }
        setUser(currentUser);
      } else {
        router.push("/master/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // --- 操作ハンドラー ---
  // 記事公開切替
  const toggleArticlePublish = (id: number) => {
    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isPublished: !a.isPublished } : a))
    );
  };

  // 記事削除
  const deleteArticle = (id: number) => {
    if (confirm("この記事を削除しますか？")) {
      setArticles((prev) => prev.filter((a) => a.id !== id));
    }
  };

  // 記事作成
  const handleCreateArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArticleTitle) return;
    const newArt: Article = {
      id: Date.now(),
      title: newArticleTitle,
      author: "MASTER",
      isPublished: true,
      date: new Date().toISOString().split("T")[0].replace(/-/g, "."),
    };
    setArticles([newArt, ...articles]);
    setNewArticleTitle("");
    alert("記事を公開しました！");
  };

  // メール送信
  const handleSendMail = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`【Yellstarメール送信完了】\n宛先: ${mailTarget}\n件名: ${mailSubject}`);
    setMailSubject("");
    setMailBody("");
  };

  // 通報対応完了
  const resolveReport = (id: number) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "対応済み" } : r))
    );
  };

  // 質問返信
  const handleReplyInquiry = (id: number) => {
    const replyText = replyInputs[id];
    if (!replyText) return;
    setInquiries((prev) =>
      prev.map((iq) =>
        iq.id === id ? { ...iq, reply: replyText, status: "回答済み" } : iq
      )
    );
    setReplyInputs((prev) => ({ ...prev, [id]: "" }));
    alert("回答を送信しました！");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 font-mono">
        Authenticating Master Authorization...
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* トップヘッダー */}
      <header className="border-b border-red-900/40 bg-slate-900/90 sticky top-0 z-50 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-xl tracking-widest text-red-500">Yellstar</span>
            <span className="rounded border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-red-400">
              MASTER CONTROL
            </span>
          </div>
          <span className="font-mono text-xs text-slate-400">{user?.email}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* ナビゲーションタブ */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {[
            { id: "articles", label: "📰 記事管理" },
            { id: "mail", label: "✉️ Yellstarメール作成" },
            { id: "reports", label: `🚨 通報確認 (${reports.filter((r) => r.status === "未対応").length})` },
            { id: "inquiries", label: `💬 質問回答 (${inquiries.filter((i) => i.status === "未回答").length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition ${
                activeTab === tab.id
                  ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* --- 1. 記事管理タブ --- */}
        {activeTab === "articles" && (
          <div className="space-y-6">
            {/* クイック記事投稿 */}
            <form onSubmit={handleCreateArticle} className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex gap-3">
              <input
                type="text"
                value={newArticleTitle}
                onChange={(e) => setNewArticleTitle(e.target.value)}
                placeholder="マスター権限で新しい公式記事を作成..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-500"
              />
              <button type="submit" className="bg-red-600 hover:bg-red-500 px-5 py-2.5 rounded-xl font-bold text-xs transition">
                即時公開
              </button>
            </form>

            {/* 記事一覧 */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">タイトル</th>
                    <th className="p-3.5">投稿者</th>
                    <th className="p-3.5">日付</th>
                    <th className="p-3.5">状態</th>
                    <th className="p-3.5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {articles.map((art) => (
                    <tr key={art.id} className="hover:bg-slate-800/20">
                      <td className="p-3.5 font-bold text-white">{art.title}</td>
                      <td className="p-3.5 text-slate-400">{art.author}</td>
                      <td className="p-3.5 font-mono text-slate-500">{art.date}</td>
                      <td className="p-3.5">
                        <button
                          onClick={() => toggleArticlePublish(art.id)}
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            art.isPublished ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-700 text-slate-400"
                          }`}
                        >
                          {art.isPublished ? "● 公開中" : "○ 非公開"}
                        </button>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button onClick={() => alert("編集モード")} className="text-indigo-400 hover:underline">編集</button>
                        <button onClick={() => deleteArticle(art.id)} className="text-red-400 hover:underline">削除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- 2. Yellstarメール作成タブ --- */}
        {activeTab === "mail" && (
          <form onSubmit={handleSendMail} className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h2 className="font-bold text-base text-white">Yellstar 公式メール・お知らせ配信</h2>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-bold">配信対象</label>
              <select
                value={mailTarget}
                onChange={(e) => setMailTarget(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
              >
                <option value="all">全ユーザー（全体お知らせ）</option>
                <option value="editors">全エディターのみ</option>
                <option value="specific">特定のアカウントID指定</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-bold">件名</label>
              <input
                type="text"
                value={mailSubject}
                onChange={(e) => setMailSubject(e.target.value)}
                required
                placeholder="例: 【重要】サービスメンテナンスのお知らせ"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-bold">本文</label>
              <textarea
                value={mailBody}
                onChange={(e) => setMailBody(e.target.value)}
                required
                rows={6}
                placeholder="配信するメッセージ本文を入力してください..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none"
              />
            </div>
            <button type="submit" className="bg-red-600 hover:bg-red-500 font-bold text-xs px-6 py-3 rounded-xl transition">
              送信・配信を実行する
            </button>
          </form>
        )}

        {/* --- 3. ユーザー通報確認タブ --- */}
        {activeTab === "reports" && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">対象ユーザー</th>
                  <th className="p-3.5">通報者</th>
                  <th className="p-3.5">通報理由</th>
                  <th className="p-3.5">日付</th>
                  <th className="p-3.5">ステータス</th>
                  <th className="p-3.5 text-right">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-800/20">
                    <td className="p-3.5 font-bold text-red-400">{rep.targetUser}</td>
                    <td className="p-3.5 text-slate-400">{rep.reporter}</td>
                    <td className="p-3.5 text-slate-200">{rep.reason}</td>
                    <td className="p-3.5 font-mono text-slate-500">{rep.date}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${rep.status === "未対応" ? "bg-red-500/20 text-red-400" : "bg-slate-800 text-slate-500"}`}>
                        {rep.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {rep.status === "未対応" && (
                        <button onClick={() => resolveReport(rep.id)} className="bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-slate-300 font-bold">
                          対応済みにする
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- 4. 運営への質問確認・回答タブ --- */}
        {activeTab === "inquiries" && (
          <div className="space-y-4">
            {inquiries.map((iq) => (
              <div key={iq.id} className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-amber-400">👤 {iq.userName} からの質問</span>
                  <span className="font-mono text-slate-500">{iq.date}</span>
                </div>
                <p className="text-xs text-white bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  {iq.question}
                </p>

                {iq.status === "回答済み" ? (
                  <div className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 p-3 rounded-xl">
                    <span className="font-bold">回答済み:</span> {iq.reply}
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={replyInputs[iq.id] || ""}
                      onChange={(e) => setReplyInputs({ ...replyInputs, [iq.id]: e.target.value })}
                      placeholder="ユーザーへの回答を入力..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs text-white focus:outline-none"
                    />
                    <button
                      onClick={() => handleReplyInquiry(iq.id)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
                    >
                      回答を送信
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}