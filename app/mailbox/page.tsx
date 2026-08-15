"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  getDocs,
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
  const [isBanned, setIsBanned] = useState(false);
  const [tab, setTab] = useState<"inbox" | "sent" | "compose">("inbox");

  // メッセージ一覧 State
  const [inboxMails, setInboxMails] = useState<MailMessage[]>([]);
  const [sentMails, setSentMails] = useState<MailMessage[]>([]);

  // フォーム状態
  const [toInput, setToInput] = useState("");
  const [subjectInput, setSubjectInput] = useState("");
  const [bodyInput, setBodyInput] = useState("");
  const [sending, setSending] = useState(false);

  // 詳細表示中のメール & 返信元メール
  const [selectedMail, setSelectedMail] = useState<MailMessage | null>(null);
  const [replyToMail, setReplyToMail] = useState<MailMessage | null>(null);

  const router = useRouter();

  // 1. ログイン認証の監視 & BANチェック
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userEmail = (currentUser.email || "").trim().toLowerCase();

        // --- BANチェック ---
        try {
          const querySnapshot = await getDocs(collection(db, "bannedUsers"));

          let isMatched = false;
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (docSnap.id.trim().toLowerCase() === userEmail && data.banned === true) {
              isMatched = true;
            }
          });

          if (isMatched) {
            setIsBanned(true);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error("BAN確認エラー:", err);
        }

        setUser(currentUser);

        // --- 受信トレイのリアルタイム監視 ---
        const inboxQuery = query(
          collection(db, "messages"),
          where("toEmail", "in", [userEmail, "all"])
        );

        const unsubscribeInbox = onSnapshot(inboxQuery, (snapshot) => {
          const mails: MailMessage[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<MailMessage, "id">),
          }));

          mails.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });

          setInboxMails(mails);
        });

        // --- 送信済みトレイのリアルタイム監視 ---
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

  // 2. メール送信処理
  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || sending) return;

    setSending(true);
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
      setToInput("");
      setSubjectInput("");
      setBodyInput("");
      setReplyToMail(null);
      setTab("sent");
    } catch (error: any) {
      console.error("メール送信エラー:", error);
      alert("送信に失敗しました: " + error.message);
    } finally {
      setSending(false);
    }
  };

  // 3. メールを閲覧＆既読に更新
  const openMail = async (mail: MailMessage) => {
    setSelectedMail(mail);

    if (!mail.isRead && mail.toEmail === user?.email) {
      try {
        const mailRef = doc(db, "messages", mail.id);
        await updateDoc(mailRef, { isRead: true });
      } catch (err) {
        console.error("既読更新エラー:", err);
      }
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "送信中...";
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleString("ja-JP");
    }
    return "----/--/--";
  };

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <div className="relative flex flex-col items-center gap-3 text-xs font-semibold tracking-wider text-slate-500">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          メールボックスを同期中...
        </div>
      </main>
    );
  }

  // BANされた場合の専用画面
  if (isBanned) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-slate-100 px-6 text-slate-800">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-2xl space-y-6"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-2xl text-rose-600 border border-rose-100 shadow-sm">
            ⛔️
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">403 Access Denied</h1>
            <p className="font-mono text-xs text-rose-500 font-semibold">ACCOUNT SUSPENDED</p>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            このアカウントはシステム管理者によって利用停止（BAN）措置が取られています。
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={async () => {
              await auth.signOut();
              router.push("/login");
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            ログアウトしてログイン画面へ戻る
          </motion.button>
        </motion.div>
      </main>
    );
  }

  const unreadCount = inboxMails.filter((m) => !m.isRead).length;

  return (
    <div className="relative min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* 背景ベクターグラフィック装飾 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[36rem] w-[36rem] rounded-full bg-gradient-to-br from-indigo-200/40 to-blue-200/30 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-[30rem] w-[30rem] rounded-full bg-gradient-to-tr from-sky-200/30 to-indigo-100/40 blur-3xl" />
      </div>

      {/* ヘッダー */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 px-6 py-3.5 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/20">
              ★
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
              Yellstar Mail
            </span>
          </div>
          <span className="max-w-[200px] truncate rounded-full border border-slate-200 bg-slate-100/80 px-3.5 py-1 font-mono text-xs text-slate-600 md:max-w-none">
            {user?.email}
          </span>
        </div>
      </header>

      {/* メインレイアウト */}
      <main className="relative mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 py-8 md:grid-cols-4">
        {/* 左ナビゲーション */}
        <div className="space-y-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setTab("compose");
              setSelectedMail(null);
              setReplyToMail(null);
              setToInput("");
              setSubjectInput("");
            }}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3 text-xs font-bold text-white shadow-md shadow-indigo-500/20 transition hover:shadow-lg hover:shadow-indigo-500/30"
          >
            <span>✏️</span> 新規メール作成
          </motion.button>

          <button
            onClick={() => {
              setTab("inbox");
              setSelectedMail(null);
            }}
            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-xs font-bold transition-all duration-200 ${
              tab === "inbox"
                ? "border-indigo-200 bg-indigo-50/70 text-indigo-700 shadow-sm"
                : "border-transparent text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-2">📥 受信トレイ</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setTab("sent");
              setSelectedMail(null);
            }}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-xs font-bold transition-all duration-200 ${
              tab === "sent"
                ? "border-indigo-200 bg-indigo-50/70 text-indigo-700 shadow-sm"
                : "border-transparent text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            📤 送信済みトレイ
          </button>
        </div>

        {/* 右メインコンテナ */}
        <div className="relative min-h-[500px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-xl backdrop-blur-xl md:col-span-3">
          <AnimatePresence mode="wait">
            {selectedMail ? (
              /* --- メール詳細表示画面 --- */
              <motion.div
                key="detail"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <button
                  onClick={() => setSelectedMail(null)}
                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 transition hover:underline"
                >
                  ← 一覧に戻る
                </button>

                <div className="space-y-4 border-b border-slate-100 pb-5">
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {selectedMail.subject}
                  </h2>
                  <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 font-mono text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-400">差出人:</span>
                      <span className="font-bold text-slate-800">
                        {selectedMail.fromName} ({selectedMail.fromEmail})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-400">宛先:</span>
                      <span className="text-slate-700">{selectedMail.toEmail}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-400">日時:</span>
                      <span className="text-slate-500">{formatDate(selectedMail.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 min-h-[150px]">
                  {selectedMail.body}
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setReplyToMail(selectedMail); // 返信元メッセージを保持
                      setToInput(selectedMail.fromEmail);
                      setSubjectInput(`Re: ${selectedMail.subject}`);
                      setSelectedMail(null);
                      setTab("compose");
                    }}
                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-slate-800"
                  >
                    ↩️ 返信する
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              /* --- タブ別表示画面 --- */
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* 受信トレイ */}
                {tab === "inbox" && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-bold text-slate-700">📥 受信メッセージ</h2>
                    {inboxMails.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        受信メッセージはありません
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {inboxMails.map((m, i) => (
                          <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                            onClick={() => openMail(m)}
                            className={`group flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                              m.isRead
                                ? "border-slate-100 bg-slate-50/50 text-slate-600 hover:bg-slate-50"
                                : "border-indigo-100 bg-indigo-50/30 text-slate-900 font-semibold shadow-sm hover:border-indigo-200 hover:bg-indigo-50/60"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 font-mono text-xs text-indigo-600">
                                {!m.isRead && (
                                  <span className="h-2 w-2 rounded-full bg-indigo-600 shadow-sm" />
                                )}
                                {m.fromName} ({m.fromEmail})
                              </div>
                              <div className={`text-sm ${!m.isRead ? "font-bold text-slate-900" : "text-slate-700"}`}>
                                {m.subject}
                              </div>
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              {formatDate(m.createdAt)}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 送信済みトレイ */}
                {tab === "sent" && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-bold text-slate-700">📤 送信済みメッセージ</h2>
                    {sentMails.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        送信済みメッセージはありません
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {sentMails.map((m, i) => (
                          <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                            onClick={() => setSelectedMail(m)}
                            className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
                          >
                            <div className="space-y-1">
                              <div className="font-mono text-xs text-slate-400">宛先: {m.toEmail}</div>
                              <div className="text-sm font-bold text-slate-800">{m.subject}</div>
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              {formatDate(m.createdAt)}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 新規作成 & 返信画面 */}
                {tab === "compose" && (
                  <form onSubmit={handleSendMail} className="space-y-5">
                    <h2 className="text-sm font-bold text-slate-700">
                      {replyToMail ? "↩️ メッセージに返信" : "✏️ 新規メール作成"}
                    </h2>

                    {/* ★返信対象の元メール表示領域 */}
                    {replyToMail && (
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-indigo-100/80 pb-2">
                          <span className="font-bold text-indigo-900">返信先の元メッセージ</span>
                          <button
                            type="button"
                            onClick={() => setReplyToMail(null)}
                            className="text-[11px] font-semibold text-rose-500 hover:underline"
                          >
                            引用解除
                          </button>
                        </div>
                        <div className="font-mono text-slate-600">
                          <span className="font-semibold">件名:</span> {replyToMail.subject}
                        </div>
                        <div className="font-mono text-slate-600">
                          <span className="font-semibold">差出人:</span> {replyToMail.fromName} ({replyToMail.fromEmail})
                        </div>
                        <div className="mt-2 rounded-xl border border-slate-200/60 bg-white p-3 text-slate-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {replyToMail.body}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">
                        宛先（完全なメールアドレスを入力）
                      </label>
                      <input
                        type="email"
                        value={toInput}
                        onChange={(e) => setToInput(e.target.value)}
                        required
                        placeholder="例: user@yellstar.local"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-800 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">件名</label>
                      <input
                        type="text"
                        value={subjectInput}
                        onChange={(e) => setSubjectInput(e.target.value)}
                        required
                        placeholder="件名を入力..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-800 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">本文</label>
                      <textarea
                        value={bodyInput}
                        onChange={(e) => setBodyInput(e.target.value)}
                        required
                        rows={6}
                        placeholder="メッセージを入力..."
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={sending}
                      className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-3 text-xs font-bold text-white shadow-md shadow-indigo-500/20 transition hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50"
                    >
                      {sending ? "送信中..." : "送信する"}
                    </motion.button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}