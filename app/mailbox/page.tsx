"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface MailMessage {
  id: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  body: string;
  createdAt: any;
  isRead: boolean;
}

export default function MailboxPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"inbox" | "sent" | "compose">("inbox");

  // メッセージ一覧 State
  const [inboxMails, setInboxMails] = useState<MailMessage[]>([]);
  const [sentMails, setSentMails] = useState<MailMessage[]>([]);

  // フォーム状態
  const [toInput, setToInput] = useState("");
  const [subjectInput, setSubjectInput] = useState("");
  const [bodyInput, setBodyInput] = useState("");
  const [sending, setSending] = useState(false);

  // 詳細表示中のメール
  const [selectedMail, setSelectedMail] = useState<MailMessage | null>(null);

  const router = useRouter();

  // 1. ログイン認証の監視 & Firestoreリアルタイムリスナー設定
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userEmail = currentUser.email || "";

        // --- 📥 受信トレイのリアルタイム監視 ---
        const inboxQuery = query(
          collection(db, "messages"),
          where("toEmail", "in", [userEmail, "all"])
        );

        const unsubscribeInbox = onSnapshot(inboxQuery, (snapshot) => {
          const mails: MailMessage[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<MailMessage, "id">),
          }));

          // 日時順（新しい順）に並び替え
          mails.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });

          setInboxMails(mails);
        });

        // --- 📤 送信済みトレイのリアルタイム監視 ---
        const sentQuery = query(
          collection(db, "messages"),
          where("fromEmail", "==", userEmail)
        );

        const unsubscribeSent = onSnapshot(sentQuery, (snapshot) => {
          const mails: MailMessage[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<MailMessage, "id">),
          }));

          mails.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });

          setSentMails(mails);
        });

        setLoading(false);

        // クリーンアップ
        return () => {
          unsubscribeInbox();
          unsubscribeSent();
        };
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  // 2. メール送信処理 (Firestoreへ保存)
  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || sending) return;

    setSending(true);

    // 入力された宛先アドレスをそのまま（補完なし）使用
    const formattedTo = toInput.trim();

    try {
      await addDoc(collection(db, "messages"), {
        fromEmail: user.email,
        fromName: user.displayName || user.email?.split("@")[0] || "ユーザー",
        toEmail: formattedTo,
        subject: subjectInput.trim(),
        body: bodyInput.trim(),
        createdAt: serverTimestamp(),
        isRead: false,
      });

      alert(`メールを送信しました！\n宛先: ${formattedTo}`);

      // フォームリセット
      setToInput("");
      setSubjectInput("");
      setBodyInput("");
      setTab("sent");
    } catch (error: any) {
      console.error("メール送信エラー:", error);
      alert("送信に失敗しました: " + error.message);
    } finally {
      setSending(false);
    }
  };

  // 3. メールを閲覧＆既読（isRead: true）に更新
  const openMail = async (mail: MailMessage) => {
    setSelectedMail(mail);

    // 未読かつ自分が受信者の場合、Firestoreの既読フラグを更新
    if (!mail.isRead && mail.toEmail === user?.email) {
      try {
        const mailRef = doc(db, "messages", mail.id);
        await updateDoc(mailRef, { isRead: true });
      } catch (err) {
        console.error("既読更新エラー:", err);
      }
    }
  };

  // 日時のフォーマット表示ヘルパー
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "送信中...";
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleString("ja-JP");
    }
    return "----/--/--";
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 font-mono">
        メールボックスを同期中...
      </main>
    );
  }

  const unreadCount = inboxMails.filter((m) => !m.isRead).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-amber-400 text-lg">Yellstar</span>
            <span className="bg-indigo-600/30 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-500/30">
              ✉️ Realtime Mail
            </span>
          </div>
          <span className="font-mono text-xs text-slate-400">{user?.email}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* 左ナビゲーション */}
        <div className="space-y-2">
          <button
            onClick={() => {
              setTab("compose");
              setSelectedMail(null);
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 mb-4"
          >
            <span>✏️</span> 新規メール作成
          </button>

          <button
            onClick={() => {
              setTab("inbox");
              setSelectedMail(null);
            }}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between ${
              tab === "inbox" ? "bg-slate-800 text-amber-400" : "text-slate-400 hover:bg-slate-900"
            }`}
          >
            <span>📥 受信トレイ</span>
            {unreadCount > 0 && (
              <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setTab("sent");
              setSelectedMail(null);
            }}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              tab === "sent" ? "bg-slate-800 text-amber-400" : "text-slate-400 hover:bg-slate-900"
            }`}
          >
            📤 送信済みトレイ
          </button>
        </div>

        {/* 右メイン表示 */}
        <div className="md:col-span-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 min-h-[450px]">
          {selectedMail ? (
            /* メール詳細表示 */
            <div className="space-y-4">
              <button
                onClick={() => setSelectedMail(null)}
                className="text-xs text-indigo-400 hover:underline font-bold flex items-center gap-1"
              >
                ← 一覧に戻る
              </button>

              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-lg font-bold text-white mb-2">{selectedMail.subject}</h2>
                <div className="text-xs text-slate-400 space-y-1 font-mono">
                  <div>
                    差出人: <span className="text-slate-200">{selectedMail.fromName} ({selectedMail.fromEmail})</span>
                  </div>
                  <div>宛先: <span className="text-slate-200">{selectedMail.toEmail}</span></div>
                  <div>日時: <span>{formatDate(selectedMail.createdAt)}</span></div>
                </div>
              </div>

              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap pt-2">
                {selectedMail.body}
              </div>

              <div className="pt-6 border-t border-slate-800">
                <button
                  onClick={() => {
                    setToInput(selectedMail.fromEmail);
                    setSubjectInput(`Re: ${selectedMail.subject}`);
                    setSelectedMail(null);
                    setTab("compose");
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition text-slate-200"
                >
                  ↩️ 返信する
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 受信トレイ */}
              {tab === "inbox" && (
                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-300 mb-4">📥 受信メッセージ</h2>
                  {inboxMails.length === 0 ? (
                    <p className="text-xs text-slate-500 py-8 text-center">受信メッセージはありません</p>
                  ) : (
                    inboxMails.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => openMail(m)}
                        className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          m.isRead
                            ? "bg-slate-950/40 border-slate-800/80 text-slate-400"
                            : "bg-slate-800/60 border-indigo-500/40 text-white font-bold shadow-md shadow-indigo-950/30"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="text-xs font-mono text-indigo-400">
                            {m.fromName} ({m.fromEmail})
                          </div>
                          <div className="text-sm">{m.subject}</div>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {formatDate(m.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 送信済みトレイ */}
              {tab === "sent" && (
                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-300 mb-4">📤 送信済みメッセージ</h2>
                  {sentMails.length === 0 ? (
                    <p className="text-xs text-slate-500 py-8 text-center">送信済みメッセージはありません</p>
                  ) : (
                    sentMails.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMail(m)}
                        className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 text-slate-300 hover:bg-slate-800/40 transition cursor-pointer flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="text-xs font-mono text-slate-400">宛先: {m.toEmail}</div>
                          <div className="text-sm font-bold text-white">{m.subject}</div>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {formatDate(m.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* メール作成 */}
              {tab === "compose" && (
                <form onSubmit={handleSendMail} className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-300 mb-4">✏️ 新規メール作成</h2>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      宛先（完全なメールアドレスを入力してください）
                    </label>
                    <input
                      type="email"
                      value={toInput}
                      onChange={(e) => setToInput(e.target.value)}
                      required
                      placeholder="例: user@yellstar.local, editor@yellstareditor.local, master@yellstarmaster.local"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">件名</label>
                    <input
                      type="text"
                      value={subjectInput}
                      onChange={(e) => setSubjectInput(e.target.value)}
                      required
                      placeholder="件名を入力..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">本文</label>
                    <textarea
                      value={bodyInput}
                      onChange={(e) => setBodyInput(e.target.value)}
                      required
                      rows={6}
                      placeholder="メッセージを入力..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-xl transition shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                  >
                    {sending ? "送信中..." : "送信する"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}