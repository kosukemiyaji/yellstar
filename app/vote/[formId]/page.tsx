"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  onAuthStateChanged,
  User,
  signInWithPopup,
  OAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ArrowLeft,
  Mail,
  ShieldCheck,
  Lock,
  User as UserIcon,
  AlertCircle,
  Building2,
  Vote,
  MessageSquare,
  CheckCircle2,
  Circle,
  Send,
  LogOut
} from "lucide-react";

// --- UIコンポーネント ---
function GlassPanel({
  children,
  className = "",
  highlight = false,
}: {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border bg-white/80 backdrop-blur-xl shadow-xl shadow-slate-200/50 ${
        highlight ? "border-slate-200/80" : "border-white/60"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// 投票の選択肢データ
const VOTING_OPTIONS = [
  { id: "opt_1", title: "デザイン案 A", description: "モダンでクリーンなグラスモーフィズム" },
  { id: "opt_2", title: "デザイン案 B", description: "ダークモードを基調としたサイバーパンク" },
  { id: "opt_3", title: "デザイン案 C", description: "親しみやすいポップなフラットデザイン" },
];

export default function VotingPage() {
  const router = useRouter();

  // 状態管理
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // ログイン関連のステート
  const [authMode, setAuthMode] = useState<"select" | "email_login" | "email_register">("select");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 投票関連のステート
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // ユーザーの認証状態を監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // セキュリティルールの `responses` コレクションに合わせて参照を取得
          const voteDoc = await getDoc(doc(db, "responses", currentUser.uid));
          if (voteDoc.exists()) {
            setHasVoted(true);
            setSelectedOption(voteDoc.data().optionId);
          }
        } catch (error) {
          console.error("Firestore Error:", error);
        }
      } else {
        setHasVoted(false);
        setSelectedOption(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const showToast = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 3500);
  };

  // --- ログイン処理 ---

  // 1. Yellstar連携 (モック処理)
  const handleYellstarLogin = async () => {
    showToast("Yellstar連携を行うには、認証用のメールアドレス登録機能をご利用ください", "error");
  };

  // 2. Discord一時連携
  const handleDiscordLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const provider = new OAuthProvider("discord.com");
      provider.addScope("identify");
      await signInWithPopup(auth, provider);
      showToast("Discord連携でログインしました", "success");
    } catch (error: any) {
      setAuthError("Discordログインに失敗しました: " + (error.message || ""));
    } finally {
      setAuthLoading(false);
    }
  };

  // 3. メールアドレス登録・ログイン (認証なし/即時登録)
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError("メールアドレスとパスワードを入力してください");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (authMode === "email_register") {
        await createUserWithEmailAndPassword(auth, email, password);
        showToast("アカウントを作成してログインしました", "success");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("ログインしました", "success");
      }
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        setAuthError("このメールアドレスは既に登録されています。ログインをお試しください。");
      } else if (error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
        setAuthError("メールアドレスまたはパスワードが正しくありません。");
      } else if (error.code === "auth/weak-password") {
        setAuthError("パスワードは6文字以上で指定してください。");
      } else {
        setAuthError(error.message || "認証に失敗しました");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    setAuthMode("select");
    setSelectedOption(null);
    setHasVoted(false);
    showToast("ログアウトしました", "success");
  };

  // --- 投票処理 ---
  const handleVote = async () => {
    if (!user) {
      showToast("投票するにはログインが必要です", "error");
      return;
    }
    if (!selectedOption || hasVoted) return;

    setVoteLoading(true);
    try {
      // セキュリティルールで許可されている `responses` コレクションを使用
      const voteRef = doc(db, "responses", user.uid);
      await setDoc(voteRef, {
        optionId: selectedOption,
        votedAt: serverTimestamp(),
        userId: user.uid,
        userEmail: user.email || null,
      });
      setHasVoted(true);
      showToast("投票が完了しました！ご協力ありがとうございます。", "success");
    } catch (error: any) {
      console.error("Vote Error:", error);
      showToast("投票の送信に失敗しました (権限エラー)", "error");
    } finally {
      setVoteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-gray-100 to-slate-200">
        <p className="animate-pulse text-xs font-semibold tracking-widest uppercase text-slate-500">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-gray-100 to-slate-200 px-4 py-8 sm:px-6 lg:px-10 lg:py-10 font-sans text-slate-800">
      <div className="relative mx-auto max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="group inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-xs font-bold text-slate-600 shadow-md shadow-slate-200/40 backdrop-blur-xl transition hover:bg-white hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition group-hover:-translate-x-0.5" />
            メイン画面へ戻る
          </Link>

          <div className="flex items-center gap-2">
            <Vote className="w-4 h-4 text-slate-500" />
            <h1 className="text-sm font-bold uppercase tracking-[0.25em] text-slate-600">
              Yellstar Voting
            </h1>
          </div>
        </div>

        {/* トースト表示 */}
        {message && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-center text-xs font-bold backdrop-blur-xl ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50/90 text-emerald-700"
                : "border-rose-200 bg-rose-50/90 text-rose-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {!user ? (
          /* =========================================
             ログイン・アカウント作成 画面
          ========================================= */
          <div className="mx-auto max-w-md">
            <GlassPanel className="p-6 sm:p-8">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200">
                  <ShieldCheck className="w-6 h-6 text-slate-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">投票に参加する</h2>
                <p className="mt-2 text-xs text-slate-500 font-medium">
                  投票を行うにはログインが必要です
                </p>
              </div>

              {authMode === "select" ? (
                <div className="space-y-3">
                  <button
                    onClick={handleYellstarLogin}
                    disabled={authLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-amber-400 py-3.5 text-sm font-bold text-amber-950 transition hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Building2 className="w-4 h-4" />
                    Yellstarアカウントでログイン
                  </button>

                  <button
                    onClick={handleDiscordLogin}
                    disabled={authLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#5865F2] py-3.5 text-sm font-bold text-white transition hover:bg-[#4752C4] active:scale-[0.98] disabled:opacity-50"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Discord連携でログイン
                  </button>

                  <div className="my-6 flex items-center justify-center gap-2">
                    <div className="h-px w-full bg-slate-200"></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                      または
                    </span>
                    <div className="h-px w-full bg-slate-200"></div>
                  </div>

                  <button
                    onClick={() => setAuthMode("email_register")}
                    disabled={authLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Mail className="w-4 h-4" />
                    メールアドレスで登録 (認証なし)
                  </button>

                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setAuthMode("email_login")}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                    >
                      既に登録済みの方はこちら (ログイン)
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div className="mb-2 text-center">
                    <span className="text-xs font-bold text-slate-700">
                      {authMode === "email_register" ? "新規アカウント作成" : "メールアドレスでログイン"}
                    </span>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <Mail className="w-3 h-3" />
                      メールアドレス
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="mail@example.com"
                      disabled={authLoading}
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <Lock className="w-3 h-3" />
                      パスワード
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={authLoading}
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                    />
                  </div>

                  {authError && (
                    <div className="flex items-start gap-1.5 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-600 border border-rose-100">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full rounded-2xl bg-slate-800 py-3.5 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {authLoading
                      ? "処理中..."
                      : authMode === "email_register"
                      ? "登録して進む"
                      : "ログイン"}
                  </button>

                  <div className="mt-4 flex flex-col gap-2 text-center">
                    {authMode === "email_register" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("email_login");
                          setAuthError(null);
                        }}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                      >
                        既に登録済みの方はこちら
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("email_register");
                          setAuthError(null);
                        }}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                      >
                        新規登録はこちら
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("select");
                        setAuthError(null);
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-slate-600 transition mt-1"
                    >
                      他のログイン方法を選ぶ
                    </button>
                  </div>
                </form>
              )}
            </GlassPanel>
          </div>
        ) : (
          /* =========================================
             投票画面 (ログイン済み)
          ========================================= */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* 左側: アカウントステータス */}
            <div className="lg:col-span-4">
              <GlassPanel className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-slate-500" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Your Account
                  </p>
                </div>
                
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 mb-6">
                  <p className="text-xs text-slate-500 mb-1">ログインアカウント</p>
                  <p className="text-sm font-mono font-bold text-slate-800 truncate">
                    {user.email || user.uid}
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 mb-6">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-600">投票ステータス</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                      hasVoted
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {hasVoted ? "投票完了" : "未投票"}
                  </span>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  ログアウト
                </button>
              </GlassPanel>
            </div>

            {/* 右側: 投票フォーム */}
            <div className="lg:col-span-8">
              <GlassPanel highlight className="p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">対象を選択してください</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      ※ 投票は1アカウントにつき1回までです。後から変更はできません。
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {VOTING_OPTIONS.map((option) => {
                    const isSelected = selectedOption === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => !hasVoted && setSelectedOption(option.id)}
                        disabled={hasVoted}
                        className={`w-full relative flex items-center justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all text-left ${
                          isSelected
                            ? "border-amber-400 bg-amber-50/50 shadow-md shadow-amber-100/50"
                            : "border-slate-200 bg-white/60 hover:bg-white/90 hover:border-slate-300"
                        } ${hasVoted ? "cursor-default opacity-80" : "cursor-pointer"}`}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 h-full w-1 bg-amber-400" />
                        )}
                        <div className="flex-1 pr-4">
                          <h3
                            className={`text-sm font-bold ${
                              isSelected ? "text-amber-900" : "text-slate-800"
                            }`}
                          >
                            {option.title}
                          </h3>
                          <p
                            className={`mt-1 text-xs ${
                              isSelected ? "text-amber-700/80" : "text-slate-500"
                            }`}
                          >
                            {option.description}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {isSelected ? (
                            <CheckCircle2 className="w-6 h-6 text-amber-500" />
                          ) : (
                            <Circle className="w-6 h-6 text-slate-300" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <button
                    onClick={handleVote}
                    disabled={!selectedOption || hasVoted || voteLoading}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white transition ${
                      hasVoted
                        ? "bg-emerald-500 cursor-not-allowed"
                        : "bg-slate-800 hover:bg-slate-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    }`}
                  >
                    {voteLoading ? (
                      "投票を送信中..."
                    ) : hasVoted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> 投票を受け付けました
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> 選択した内容で投票する
                      </>
                    )}
                  </button>
                </div>
              </GlassPanel>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}