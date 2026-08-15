"use client";

import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  ArrowLeft,
  CreditCard,
  Send,
  ShieldCheck,
  Lock,
  Clock,
  Eye,
  EyeOff,
  User as UserIcon,
  BadgeCheck,
  AlertCircle,
  Building2,
} from "lucide-react";

interface Transaction {
  id: number;
  type: "account_open" | "transfer_out" | "transfer_in";
  label: string;
  amount: number;
  date: string;
  counterpartyUid?: string;
}

interface BankAccount {
  accountName: string;
  pin: string; // ここにはハッシュ化されたPINが保存されます
  cardNumber: string;
  balance: number;
  tier: string;
  history: Transaction[];
}

// 暗証番号（文字列）をSHA-256でハッシュ化する関数
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function formatDateLabel(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function generateCardNumber(): string {
  const segment = () => String(Math.floor(1000 + Math.random() * 9000));
  return `4532-${segment()}-${segment()}-${segment()}`;
}

function normalizeCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 16) return raw.trim();
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 16)}`;
}

function maskCardNumber(cardNumber: string): string {
  const formatted = normalizeCardNumber(cardNumber);
  const digits = formatted.replace(/\D/g, "");
  if (digits.length < 8) return "•••• •••• •••• ••••";
  const first = digits.slice(0, 4);
  const last = digits.slice(-4);
  return `${first} •••• •••• ${last}`;
}

function getDisplayedCardNumber(cardNumber: string, visible: boolean): string {
  if (!cardNumber) return "•••• •••• •••• ••••";
  const formatted = normalizeCardNumber(cardNumber);
  return visible ? formatted.replace(/-/g, " ") : maskCardNumber(formatted);
}

function computeTrustScore(
  tier: string,
  history: Transaction[],
  balance: number
): number {
  let score = tier.includes("Premium") ? 85 : 70;
  score += Math.min(history.length * 2, 20);
  if (balance > 0) score += 5;
  if (history.some((h) => h.type === "transfer_out" || h.type === "transfer_in")) {
    score += 5;
  }
  return Math.min(score, 100);
}

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

export default function BankPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const [accountName, setAccountName] = useState("");
  const [accountPin, setAccountPin] = useState(""); // 照合用にFirestoreのハッシュ化PINを保持
  const [cardNumber, setCardNumber] = useState("");
  const [balance, setBalance] = useState(0);
  const [tier, setTier] = useState("Standard Member");
  const [history, setHistory] = useState<Transaction[]>([]);

  const [showCardNumber, setShowCardNumber] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(
    null
  );

  const [setupName, setSetupName] = useState("");
  const [setupPin, setSetupPin] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [recipientCardNumber, setRecipientCardNumber] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferPin, setTransferPin] = useState(""); // 送金時に入力するPIN
  const [transferLoading, setTransferLoading] = useState(false);

  const trustScore = useMemo(
    () => computeTrustScore(tier, history, balance),
    [tier, history, balance]
  );

  const displayedCardNumber = useMemo(
    () => getDisplayedCardNumber(cardNumber, showCardNumber),
    [cardNumber, showCardNumber]
  );

  const applyAccountData = useCallback((data: BankAccount) => {
    setAccountName(data.accountName || "");
    setAccountPin(data.pin || "");
    setCardNumber(data.cardNumber ? normalizeCardNumber(data.cardNumber) : "");
    setBalance(data.balance ?? 0);
    setTier(data.tier || "Standard Member");
    setHistory(Array.isArray(data.history) ? data.history : []);
    setNeedsSetup(false);
  }, []);

  const loadAccount = useCallback(
    async (uid: string) => {
      const docRef = doc(db, "banks", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        applyAccountData(docSnap.data() as BankAccount);
      } else {
        setAccountName("");
        setAccountPin("");
        setCardNumber("");
        setBalance(0);
        setTier("Standard Member");
        setHistory([]);
        setNeedsSetup(true);
      }
    },
    [applyAccountData]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          await loadAccount(currentUser.uid);
        } catch (error) {
          console.error("口座情報の取得に失敗:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadAccount]);

  useEffect(() => {
    if (!loading && user === null) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const showToast = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 3500);
  };

  const handleOpenAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || setupLoading) return;

    const name = setupName.trim();
    if (!name) {
      setSetupError("口座名義を入力してください");
      return;
    }
    if (name.length > 40) {
      setSetupError("口座名義は40文字以内で入力してください");
      return;
    }
    if (!/^\d{4}$/.test(setupPin)) {
      setSetupError("暗証番号は4桁の数字で入力してください");
      return;
    }

    setSetupLoading(true);
    setSetupError(null);

    try {
      const docRef = doc(db, "banks", user.uid);
      const existing = await getDoc(docRef);

      if (existing.exists()) {
        applyAccountData(existing.data() as BankAccount);
        setSetupName("");
        setSetupPin("");
        showToast("既に口座が開設されています", "success");
        return;
      }

      const newCardNumber = generateCardNumber();
      const now = formatDateLabel(new Date());
      
      const hashedPin = await hashPin(setupPin);

      const initialHistory: Transaction[] = [
        {
          id: Date.now(),
          type: "account_open",
          label: "Yellstar口座開設",
          amount: 0,
          date: now,
        },
      ];

      const accountData: BankAccount = {
        accountName: name,
        pin: hashedPin,
        cardNumber: newCardNumber,
        balance: 0,
        tier: "Standard Member",
        history: initialHistory,
      };

      await setDoc(docRef, accountData);

      applyAccountData(accountData);
      setShowCardNumber(false);
      setSetupName("");
      setSetupPin("");
      showToast("口座を開設しました", "success");
    } catch (error) {
      console.error("口座開設に失敗:", error);
      const detail =
        error instanceof Error && error.message ? `（${error.message}）` : "";
      setSetupError(
        `口座開設に失敗しました。時間をおいて再度お試しください。${detail}`
      );
    } finally {
      setSetupLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || transferLoading || needsSetup) return;

    const amount = parseInt(transferAmount, 10);
    const targetCardNumber = normalizeCardNumber(recipientCardNumber);

    if (!targetCardNumber || targetCardNumber.replace(/\D/g, "").length !== 16) {
      showToast("有効な16桁のカード番号を入力してください", "error");
      return;
    }
    if (targetCardNumber === cardNumber) {
      showToast("自分自身には送金できません", "error");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      showToast("送金額は1以上の整数で入力してください", "error");
      return;
    }
    if (!/^\d{4}$/.test(transferPin)) {
      showToast("暗証番号を4桁で入力してください", "error");
      return;
    }

    setTransferLoading(true);

    try {
      const inputHashedPin = await hashPin(transferPin);
      if (inputHashedPin !== accountPin) {
        throw new Error("暗証番号が間違っています");
      }

      const banksRef = collection(db, "banks");
      const q = query(banksRef, where("cardNumber", "==", targetCardNumber));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("指定されたカード番号の口座が見つかりません");
      }

      const recipientDoc = querySnapshot.docs[0];
      const toUid = recipientDoc.id;

      const senderRef = doc(db, "banks", user.uid);
      const recipientRef = doc(db, "banks", toUid);
      const now = formatDateLabel(new Date());
      const txId = Date.now();

      let recipientName = "不明なユーザー";

      await runTransaction(db, async (transaction) => {
        const senderSnap = await transaction.get(senderRef);
        const recipientSnap = await transaction.get(recipientRef);

        if (!senderSnap.exists()) {
          throw new Error("送信者の口座が見つかりません");
        }
        if (!recipientSnap.exists()) {
          throw new Error("送金先の口座が見つかりません");
        }

        const senderData = senderSnap.data() as BankAccount;
        const recipientData = recipientSnap.data() as BankAccount;
        const currentBalance = senderData.balance ?? 0;

        if (currentBalance < amount) {
          throw new Error("残高が不足しています");
        }

        recipientName = recipientData.accountName || "不明なユーザー";

        const senderTx: Transaction = {
          id: txId,
          type: "transfer_out",
          label: `送金 → ${recipientName}`,
          amount: -amount,
          date: now,
          counterpartyUid: toUid,
        };

        const recipientTx: Transaction = {
          id: txId + 1,
          type: "transfer_in",
          label: `着金 ← ${senderData.accountName || user.uid.slice(0, 8)}`,
          amount: amount,
          date: now,
          counterpartyUid: user.uid,
        };

        transaction.update(senderRef, {
          balance: currentBalance - amount,
          history: arrayUnion(senderTx),
        });

        transaction.update(recipientRef, {
          balance: (recipientData.balance ?? 0) + amount,
          history: arrayUnion(recipientTx),
        });
      });

      setBalance((prev) => prev - amount);
      setHistory((prev) => [
        {
          id: txId,
          type: "transfer_out",
          label: `送金 → ${recipientName}`,
          amount: -amount,
          date: now,
          counterpartyUid: toUid,
        },
        ...prev,
      ]);
      
      setRecipientCardNumber("");
      setTransferAmount("");
      setTransferPin("");
      showToast(`${amount.toLocaleString()} YS の送金が完了しました`, "success");
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "送金に失敗しました";
      showToast(errMsg, "error");
    } finally {
      setTransferLoading(false);
    }
  };

  if (loading || user === null) {
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
      {/* 口座開設モーダル */}
      {needsSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-6 sm:p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200">
                <CreditCard className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Yellstar口座開設</h2>
                <p className="text-[11px] text-slate-500 font-mono">
                  Virtual account registration
                </p>
              </div>
            </div>

            <form onSubmit={handleOpenAccount} className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <UserIcon className="w-3 h-3" />
                  口座名義（アカウント名）
                </label>
                <input
                  type="text"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  placeholder="例: 山田 太郎"
                  maxLength={40}
                  disabled={setupLoading}
                  className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <Lock className="w-3 h-3" />
                  4桁の暗証番号（PIN）
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={setupPin}
                  onChange={(e) =>
                    setSetupPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="••••"
                  maxLength={4}
                  disabled={setupLoading}
                  className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition tracking-[0.5em] font-mono focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                />
              </div>

              {setupError && (
                <p className="flex items-start gap-1.5 text-xs text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {setupError}
                </p>
              )}

              <button
                type="submit"
                disabled={setupLoading}
                className="w-full rounded-2xl bg-slate-800 py-3.5 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {setupLoading ? "開設処理中..." : "口座を開設する"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-7xl">
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
            <Building2 className="w-4 h-4 text-slate-500" />
            <h1 className="text-sm font-bold uppercase tracking-[0.25em] text-slate-600">
              Yellstar Bank
            </h1>
          </div>
        </div>

        {/* トースト */}
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

        {/* ダッシュボード */}
        <div
          className={`grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-8 transition ${
            needsSetup ? "pointer-events-none opacity-40 blur-[1px]" : ""
          }`}
          aria-hidden={needsSetup}
        >
          {/* 左: 仮想カード + ステータス */}
          <div className="flex flex-col gap-6 md:col-span-1 lg:col-span-4">
            {/* リアル質感 仮想クレジットカード */}
            <div className="relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-zinc-800 p-6 text-white shadow-2xl shadow-slate-900/40 border border-slate-700/50 flex flex-col justify-between select-none">
              
              {/* 背景のホログラム光沢グラデーション */}
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
              <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

              {/* 上段: ブランドロゴ & タッチ決済マーク */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 rounded-full bg-amber-400/90 shadow-sm" />
                  <span className="font-mono text-xs font-black tracking-[0.25em] text-slate-200">
                    YELLSTAR
                  </span>
                </div>
                
                {/* タッチ決済アイコン */}
                <svg className="w-6 h-6 text-slate-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18a6 6 0 100-12 6 6 0 000 12z" className="opacity-0" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M8.5 14.5a5 5 0 010-5" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M11.5 16.5a8 8 0 000-9" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M14.5 18.5a11 11 0 000-13" />
                </svg>
              </div>

              {/* 中段: ICチップ & 表示切り替えボタン */}
              <div className="my-auto pt-2 z-10 flex items-center justify-between">
                {/* メタリック風 ICチップ */}
                <div className="relative h-9 w-11 rounded-md bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 p-1 shadow-inner border border-amber-300/60 flex flex-col justify-between">
                  <div className="h-full w-full border border-amber-600/40 rounded-[2px] grid grid-cols-2 gap-0.5">
                    <div className="border-r border-b border-amber-600/40" />
                    <div className="border-b border-amber-600/40" />
                    <div className="border-r border-amber-600/40" />
                    <div />
                  </div>
                </div>

                {/* 番号の表示/非表示トグル */}
                <button
                  type="button"
                  onClick={() => cardNumber && setShowCardNumber((v) => !v)}
                  disabled={!cardNumber}
                  className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur-md border border-white/10 hover:bg-white/20 transition active:scale-95 disabled:opacity-40"
                >
                  {showCardNumber ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" /> 隠す
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" /> 表示
                    </>
                  )}
                </button>
              </div>

              {/* 下段: カード番号 & 名義・有効期限 */}
              <div className="space-y-3 z-10">
                {/* エンボス表現のカード番号 */}
                <div className="font-mono text-base sm:text-lg tracking-[0.18em] text-slate-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {displayedCardNumber}
                </div>

                <div className="flex items-end justify-between">
                  {/* 口座名義 */}
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-slate-400 font-mono">
                      CARD HOLDER
                    </p>
                    <p className="font-mono text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-200 truncate max-w-[180px]">
                      {accountName || "YOUR NAME"}
                    </p>
                  </div>

                  {/* 有効期限 */}
                  <div className="text-right">
                    <p className="text-[8px] uppercase tracking-wider text-slate-400 font-mono">
                      VALID THRU
                    </p>
                    <p className="font-mono text-xs font-semibold text-slate-200">
                      08/30
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 利用可能残高パネル */}
            <GlassPanel>
              <div className="px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  利用可能残高
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 sm:text-4xl">
                    {balance.toLocaleString()}
                  </span>
                  <span className="text-base font-bold text-slate-500">YS</span>
                </div>
              </div>
            </GlassPanel>

            {/* アカウントステータス */}
            <GlassPanel>
              <div className="space-y-4 px-6 py-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Account Status
                </p>

                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-600">Member Tier</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">{tier}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-600">Security</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 text-right leading-tight">
                    暗号化保護・
                    <br className="sm:hidden" />
                    トランザクション保護済み
                  </span>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-slate-600">アカウント信頼スコア</span>
                    <span className="text-sm font-black text-slate-800">
                      {trustScore}
                      <span className="text-[10px] font-normal text-slate-400"> / 100</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-600 transition-all duration-700"
                      style={{ width: `${trustScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </GlassPanel>
          </div>

          {/* 中央: 送金 */}
          <div className="md:col-span-1 lg:col-span-4">
            <GlassPanel highlight>
              <div className="px-6 py-7 sm:px-7">
                <div className="mb-6 flex items-center gap-2">
                  <Send className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-700">
                    送金
                  </h2>
                </div>

                <form onSubmit={handleTransfer} className="space-y-5">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      送金先カード番号
                    </label>
                    <input
                      type="text"
                      value={recipientCardNumber}
                      onChange={(e) => setRecipientCardNumber(e.target.value)}
                      placeholder="例: 4532-1234-5678-9012"
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition font-mono focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      送金額 (YS)
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="1000"
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition font-mono focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    />
                    <p className="mt-1.5 text-[10px] text-slate-400">
                      利用可能残高: {balance.toLocaleString()} YS
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      4桁の暗証番号 (PIN)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={transferPin}
                      onChange={(e) => setTransferPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="••••"
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition tracking-[0.5em] font-mono focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-500">
                      <Lock className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                      送金は Firebase runTransaction によりアトミックに処理されます。残高不足・不正な改ざんはトランザクション内で拒否されます。
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={transferLoading || needsSetup}
                    className="w-full rounded-2xl bg-slate-800 py-4 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {transferLoading ? "送金処理中..." : "送金を実行する"}
                  </button>
                </form>
              </div>
            </GlassPanel>
          </div>

          {/* 右: 取引履歴 */}
          <div className="md:col-span-2 lg:col-span-4">
            <GlassPanel className="h-full">
              <div className="flex h-full flex-col px-5 py-6 sm:px-6">
                <div className="mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    取引履歴
                  </p>
                  <span className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-mono text-slate-500">
                    {history.length}件
                  </span>
                </div>

                {history.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center py-12 text-center">
                    <p className="text-xs text-slate-400">取引履歴はありません</p>
                  </div>
                ) : (
                  <ul className="max-h-[480px] space-y-2.5 overflow-y-auto pr-1 lg:max-h-[620px]">
                    {[...history].sort((a, b) => b.id - a.id).map((item) => (
                      <li
                        key={item.id}
                        className="relative flex items-center justify-between overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 transition hover:bg-white/80"
                      >
                        <div
                          className={`absolute left-0 top-0 h-full w-[3px] rounded-r-full ${
                            item.amount >= 0 ? "bg-emerald-400" : "bg-rose-400"
                          }`}
                        />
                        <div className="min-w-0 flex-1 pl-3">
                          <p className="truncate text-xs font-bold text-slate-800">
                            {item.label}
                          </p>
                          <p className="text-[10px] font-mono tracking-wide text-slate-400">
                            {item.date}
                          </p>
                        </div>
                        <span
                          className={`ml-3 shrink-0 text-sm font-black font-mono ${
                            item.amount >= 0 ? "text-emerald-600" : "text-rose-500"
                          }`}
                        >
                          {item.amount >= 0 ? "+" : ""}
                          {item.amount.toLocaleString()} YS
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </GlassPanel>
          </div>
        </div>
      </div>
    </div>
  );
}