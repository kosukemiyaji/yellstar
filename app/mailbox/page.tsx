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
  getDoc,
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

  // 詳細表示中のメール
  const [selectedMail, setSelectedMail] = useState<MailMessage | null>(null);

  const router = useRouter();

  // 1. ログイン認証の監視 & BANチェック
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userEmail = (currentUser.email || "").trim().toLowerCase();
        console.log("🔥 [DEBUG] 現在のログインユーザー:", userEmail);

// --- 🚫 BANチェック（banned: true の場合のみBANにする） ---
        try {
          const querySnapshot = await getDocs(collection(db, "bannedUsers"));
          console.log("🔥 [DEBUG] bannedUsersコレクション内の全ドキュメント数:", querySnapshot.size);

          let isMatched = false;
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            console.log(`- 存在するID: "${docSnap.id}" / 中身:`, data);
            
            // IDが一致し、かつ banned が true の場合のみBANにする
            if (docSnap.id.trim().toLowerCase() === userEmail && data.banned === true) {
              isMatched = true;
            }
          });

          if (isMatched) {
            console.log("🔥 [DEBUG] 🎯 実際にBAN対象のユーザーを検知しました！403画面へ切り替えます。");
            setIsBanned(true);
            setLoading(false);
            return;
          } else {
            console.log("🔥 [DEBUG] 正常ユーザーです。メールボックスを表示します。");
          }
        } catch (err) {
          console.error("🔥 [DEBUG] BAN確認エラー:", err);
        }

        setUser(currentUser);

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
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020308] text-slate-400">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[140px]" />
        <div className="relative flex flex-col items-center gap-3 font-mono text-xs tracking-[0.2em]">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
          メールボックスを同期中...
        </div>
      </main>
    );
  }

  // ★BANされている場合の403専用画面
  if (isBanned) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 text-slate-100">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[30rem] w-[30rem] rounded-full bg-red-600/10 blur-[150px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md rounded-3xl border border-red-900/40 bg-slate-900/80 p-8 text-center shadow-2xl backdrop-blur-2xl space-y-6"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/30 text-2xl shadow-lg shadow-red-950/50">
            ⛔️
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-black tracking-tight text-white">403 Forbidden</h1>
            <p className="font-mono text-xs text-red-400">ACCESS DENIED // ACCOUNT SUSPENDED</p>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            このアカウントはシステム管理者によって利用停止（BAN）措置が取られています。セキュリティ保護のため、本サービスへのアクセスは許可されていません。
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={async () => {
              await auth.signOut();
              router.push("/login");
            }}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-3 text-xs font-bold text-slate-200 shadow-lg transition hover:bg-slate-700 hover:text-white"
          >
            ログアウトしてログイン画面へ戻る
          </motion.button>
        </motion.div>
      </main>
    );
  }

  const unreadCount = inboxMails.filter((m) => !m.isRead).length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020308] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-56 left-1/4 h-[34rem] w-[34rem] rounded-full bg-indigo-600/25 blur-[150px]" />
        <div className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-amber-500/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.07)_1px,transparent_0)] [background-size:28px_28px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/40 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/30">
              ★
            </span>
            <span className="bg-gradient-to-r from-amber-300 via-amber-200 to-indigo-200 bg-clip-text text-lg font-black tracking-tight text-transparent">
              Yellstar
            </span>
            <span className="hidden rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 md:inline-block">
              ✉️ Realtime Mail
            </span>
          </div>
          <span className="max-w-[180px] truncate rounded-full border border-white/5 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-slate-400 md:max-w-none">
            {user?.email}
          </span>
        </div>
      </header>

      <main className="relative mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 py-8 md:grid-cols-4">
        {/* 左ナビゲーション */}
        <div className="space-y-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setTab("compose");
              setSelectedMail(null);
            }}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:shadow-indigo-500/50"
          >
            <span>✏️</span> 新規メール作成
          </motion.button>

          <button
            onClick={() => {
              setTab("inbox");
              setSelectedMail(null);
            }}
            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-2.5 text-xs font-bold transition-all duration-200 ${
              tab === "inbox"
                ? "border-amber-400/30 bg-amber-400/[0.08] text-amber-300 shadow-inner shadow-amber-500/10"
                : "border-transparent text-slate-400 hover:border-white/5 hover:bg-white/[0.03] hover:text-slate-200"
            }`}
          >
            <span>📥 受信トレイ</span>
            {unreadCount > 0 && (
              <span className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
                <span className="relative rounded-full bg-gradient-to-br from-amber-300 to-amber-500 px-2 py-0.5 text-[10px] font-black text-slate-950 shadow shadow-amber-500/40">
                  {unreadCount}
                </span>
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setTab("sent");
              setSelectedMail(null);
            }}
            className={`w-full rounded-2xl border px-4 py-2.5 text-left text-xs font-bold transition-all duration-200 ${
              tab === "sent"
                ? "border-amber-400/30 bg-amber-400/[0.08] text-amber-300 shadow-inner shadow-amber-500/10"
                : "border-transparent text-slate-400 hover:border-white/5 hover:bg-white/[0.03] hover:text-slate-200"
            }`}
          >
            📤 送信済みトレイ
          </button>
        </div>

        {/* 右メイン表示 */}
        <div className="relative min-h-[450px] overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl md:col-span-3">
          <AnimatePresence mode="wait">
            {selectedMail ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="space-y-5"
              >
                <button
                  onClick={() => setSelectedMail(null)}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-300 transition hover:text-indigo-200 hover:underline"
                >
                  ← 一覧に戻る
                </button>

                <div className="space-y-3 border-b border-white/5 pb-5">
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    {selectedMail.subject}
                  </h2>
                  <div className="space-y-1.5 rounded-xl border border-white/5 bg-black/20 p-3 font-mono text-[11px] text-slate-400">
                    <div>
                      差出人:{" "}
                      <span className="text-slate-200">
                        {selectedMail.fromName} ({selectedMail.fromEmail})
                      </span>
                    </div>
                    <div>
                      宛先: <span className="text-slate-200">{selectedMail.toEmail}</span>
                    </div>
                    <div>
                      日時: <span className="text-slate-300">{formatDate(selectedMail.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="whitespace-pre-wrap pt-1 text-sm leading-relaxed text-slate-200">
                  {selectedMail.body}
                </div>

                <div className="border-t border-white/5 pt-6">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setToInput(selectedMail.fromEmail);
                      setSubjectInput(`Re: ${selectedMail.subject}`);
                      setSelectedMail(null);
                      setTab("compose");
                    }}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-slate-200 transition hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-indigo-200"
                  >
                    ↩️ 返信する
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {tab === "inbox" && (
                  <div className="space-y-3">
                    <h2 className="mb-4 text-sm font-bold tracking-tight text-slate-300">
                      📥 受信メッセージ
                    </h2>
                    {inboxMails.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-500">
                        受信メッセージはありません
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {inboxMails.map((m, i) => (
                          <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                            onClick={() => openMail(m)}
                            className={`group flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                              m.isRead
                                ? "border-white/5 bg-white/[0.015] text-slate-400 hover:border-white/10 hover:bg-white/[0.03]"
                                : "border-indigo-400/30 bg-gradient-to-br from-indigo-500/[0.08] to-transparent text-white shadow-md shadow-indigo-950/40 hover:border-indigo-400/50 hover:shadow-indigo-900/40"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 font-mono text-xs text-indigo-300">
                                {!m.isRead && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow shadow-amber-400/60" />
                                )}
                                {m.fromName} ({m.fromEmail})
                              </div>
                              <div className={`text-sm ${!m.isRead ? "font-bold" : ""}`}>
                                {m.subject}
                              </div>
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {formatDate(m.createdAt)}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === "sent" && (
                  <div className="space-y-3">
                    <h2 className="mb-4 text-sm font-bold tracking-tight text-slate-300">
                      📤 送信済みメッセージ
                    </h2>
                    {sentMails.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-500">
                        送信済みメッセージはありません
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {sentMails.map((m, i) => (
                          <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                            onClick={() => setSelectedMail(m)}
                            className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-white/[0.015] p-4 text-slate-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.03] hover:shadow-lg"
                          >
                            <div className="space-y-1">
                              <div className="font-mono text-xs text-slate-500">
                                宛先: {m.toEmail}
                              </div>
                              <div className="text-sm font-bold text-white">{m.subject}</div>
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {formatDate(m.createdAt)}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === "compose" && (
                  <form onSubmit={handleSendMail} className="space-y-5">
                    <h2 className="mb-2 text-sm font-bold tracking-tight text-slate-300">
                      ✏️ 新規メール作成
                    </h2>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-400">
                        宛先（完全なメールアドレスを入力してください）
                      </label>
                      <input
                        type="email"
                        value={toInput}
                        onChange={(e) => setToInput(e.target.value)}
                        required
                        placeholder="例: user@yellstar.local"
                        className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white placeholder:text-slate-600 transition focus:border-indigo-400/50 focus:bg-black/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-400">件名</label>
                      <input
                        type="text"
                        value={subjectInput}
                        onChange={(e) => setSubjectInput(e.target.value)}
                        required
                        placeholder="件名を入力..."
                        className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white placeholder:text-slate-600 transition focus:border-indigo-400/50 focus:bg-black/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-400">本文</label>
                      <textarea
                        value={bodyInput}
                        onChange={(e) => setBodyInput(e.target.value)}
                        required
                        rows={6}
                        placeholder="メッセージを入力..."
                        className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-white placeholder:text-slate-600 transition focus:border-indigo-400/50 focus:bg-black/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={sending}
                      className="rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:shadow-indigo-500/50 disabled:opacity-50"
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