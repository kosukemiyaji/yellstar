"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ArrowLeft,
  Mail,
  Lock,
  AlertOctagon,
  ShieldAlert,
  Building2,
  Settings,
  Layers,
  MapPin,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  ListPlus,
  Link as LinkIcon,
  Copy,
  ExternalLink
} from "lucide-react";

// --- UIコンポーネント ---
function GlassPanel({ children, className = "", highlight = false }: { children: ReactNode; className?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-3xl border bg-white/80 backdrop-blur-xl shadow-xl shadow-slate-200/50 ${highlight ? "border-slate-200/80" : "border-white/60"} ${className}`}>
      {children}
    </div>
  );
}

// --- 型定義 ---
type Option = {
  id: string;
  title: string;
  description: string;
};

type Stage = {
  id: string;
  stageName: string;
  options: Option[];
};

export default function CreateFormPage() {
  // --- 認証ステート ---
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

  // --- フォームビルダー用ステート ---
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [districts, setDistricts] = useState<string[]>(["全域共通"]);
  const [stages, setStages] = useState<Stage[]>([
    { id: generateId(), stageName: "第1段階", options: [{ id: generateId(), title: "", description: "" }] }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  
  // 完了・リンク発行用ステート
  const [createdFormId, setCreatedFormId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 簡易ID生成
  function generateId() {
    return Math.random().toString(36).substring(2, 9);
  }

  // --- 認証監視 ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- ログイン処理 (管理者専用) ---
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthProcessing(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      setAuthError("ログインに失敗しました。認証情報を確認してください。");
    } finally {
      setIsAuthProcessing(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // --- フォームビルダー操作 ---
  const addDistrict = () => setDistricts([...districts, ""]);
  const updateDistrict = (index: number, val: string) => {
    const newDistricts = [...districts];
    newDistricts[index] = val;
    setDistricts(newDistricts);
  };
  const removeDistrict = (index: number) => {
    setDistricts(districts.filter((_, i) => i !== index));
  };

  const addStage = () => {
    setStages([
      ...stages,
      { id: generateId(), stageName: `第${stages.length + 1}段階`, options: [{ id: generateId(), title: "", description: "" }] }
    ]);
  };
  const updateStageName = (stageId: string, val: string) => {
    setStages(stages.map(s => s.id === stageId ? { ...s, stageName: val } : s));
  };
  const removeStage = (stageId: string) => {
    setStages(stages.filter(s => s.id !== stageId));
  };

  const addOption = (stageId: string) => {
    setStages(stages.map(s => {
      if (s.id === stageId) {
        return { ...s, options: [...s.options, { id: generateId(), title: "", description: "" }] };
      }
      return s;
    }));
  };
  const updateOption = (stageId: string, optionId: string, field: "title" | "description", val: string) => {
    setStages(stages.map(s => {
      if (s.id === stageId) {
        return {
          ...s,
          options: s.options.map(o => o.id === optionId ? { ...o, [field]: val } : o)
        };
      }
      return s;
    }));
  };
  const removeOption = (stageId: string, optionId: string) => {
    setStages(stages.map(s => {
      if (s.id === stageId) {
        return { ...s, options: s.options.filter(o => o.id !== optionId) };
      }
      return s;
    }));
  };

  // --- 保存処理 ---
  const handleSaveForm = async () => {
    if (!formTitle.trim()) {
      alert("フォームのタイトルを入力してください。");
      return;
    }
    
    setIsSaving(true);
    try {
      const newFormRef = doc(collection(db, "forms")); // IDを自動生成
      await setDoc(newFormRef, {
        title: formTitle,
        description: formDescription,
        districts: districts.filter(d => d.trim() !== ""),
        stages: stages,
        createdBy: user?.uid,
        createdAt: serverTimestamp(),
        isActive: true,
      });
      
      // 生成されたIDをセットして完了画面へ遷移
      setCreatedFormId(newFormRef.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error(error);
      alert("保存に失敗しました。権限設定を確認してください。");
    } finally {
      setIsSaving(false);
    }
  };

  // --- リンクコピー処理 ---
  const handleCopyLink = () => {
    if (!createdFormId) return;
    const url = `${window.location.origin}/vote/${createdFormId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- ローディング ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="animate-pulse text-xs font-bold tracking-widest text-slate-400">Verifying access...</p>
      </div>
    );
  }

  // --- 未ログイン：管理者ログイン画面 ---
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <GlassPanel className="w-full max-w-md p-8 !bg-slate-900/50 !border-slate-700">
          <div className="mb-6 flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 mb-4">
              <ShieldAlert className="w-6 h-6 text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-white">Yellstar 管理システム</h1>
            <p className="mt-2 text-xs text-slate-400">@yellstareditor.local のアカウントが必要です</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Mail className="w-3 h-3" /> Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yellstareditor.local"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Lock className="w-3 h-3" /> Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                required
              />
            </div>
            
            {authError && (
              <p className="text-xs text-rose-400 flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5" /> {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isAuthProcessing}
              className="mt-6 w-full rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-slate-900 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {isAuthProcessing ? "認証中..." : "ログイン"}
            </button>
          </form>
        </GlassPanel>
      </div>
    );
  }

  // --- 403 Forbidden ---
  const isAuthorized = user.email?.endsWith("@yellstareditor.local");
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-50 border border-rose-100 shadow-xl shadow-rose-200/50">
            <AlertOctagon className="w-10 h-10 text-rose-500" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">403 Forbidden</h1>
          <p className="mt-4 text-sm font-bold text-slate-600">
            アクセス権限がありません
          </p>
          <p className="mt-2 text-xs text-slate-500 max-w-sm mx-auto">
            現在のアカウント ({user.email}) は管理者権限を持っていません。<br />
            このページは @yellstareditor.local ドメインのユーザーのみアクセス可能です。
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/"
              className="rounded-xl bg-slate-800 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              トップへ戻る
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              別のアカウントでログイン
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 認可成功：保存完了＆リンク発行画面 ---
  if (createdFormId) {
    const voteUrl = typeof window !== 'undefined' ? `${window.location.origin}/vote/${createdFormId}` : "";
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 px-4 py-8">
        <GlassPanel className="text-center p-8 sm:p-12 max-w-lg w-full">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 border border-emerald-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">フォームを作成しました</h2>
          <p className="mt-3 text-sm text-slate-500 mb-8">
            有権者に以下のリンクを共有してください。<br/>
            リンクにアクセスするとログイン後、投票画面に遷移します。
          </p>
          
          <div className="mb-8 text-left">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5" /> 投票用URL
            </label>
            <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 p-2 shadow-inner">
              <input
                type="text"
                readOnly
                value={voteUrl}
                className="w-full bg-transparent px-2 text-sm text-slate-600 outline-none"
              />
              <button
                onClick={handleCopyLink}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${
                  copied 
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {copied ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> コピー完了</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> コピー</>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/vote/${createdFormId}`}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-slate-900 transition hover:bg-amber-400 shadow-lg shadow-amber-500/20"
            >
              <ExternalLink className="w-4 h-4" /> 投票画面を確認する
            </Link>
            <button
              onClick={() => {
                setCreatedFormId(null);
                setFormTitle("");
                setFormDescription("");
              }}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              新しく作成する
            </button>
          </div>
        </GlassPanel>
      </div>
    );
  }

  // --- 認可成功：フォーム作成画面 ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-100 to-slate-200 px-4 py-8 sm:px-6 lg:px-10 lg:py-10 text-slate-800">
      <div className="mx-auto max-w-5xl">
        
        {/* ヘッダー */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="group inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-xs font-bold text-slate-600 shadow-md shadow-slate-200/40 backdrop-blur-xl transition hover:bg-white"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition group-hover:-translate-x-0.5" />
            ダッシュボードへ戻る
          </Link>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-bold tracking-wider text-emerald-700 border border-emerald-200">
              <ShieldAlert className="w-3 h-3" /> ADMIN ACCESS
            </span>
            <button onClick={handleLogout} className="text-xs font-bold text-slate-500 hover:text-slate-800">
              ログアウト
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-500" />
            投票フォームビルダー
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            複数段階（役職や決選投票など）および選挙区ごとに分岐可能なフォームを作成します。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* 左カラム：基本設定＆選挙区 */}
          <div className="lg:col-span-4 space-y-6">
            <GlassPanel className="p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                基本設定
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    フォーム名 (必須)
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="例: 第3回 サーバー役員選挙"
                    className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    説明
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    placeholder="投票に関する案内や注意事項..."
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 resize-none"
                  />
                </div>
              </div>
            </GlassPanel>

            <GlassPanel className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  対象の選挙区
                </h2>
                <button
                  onClick={addDistrict}
                  className="p-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mb-4">
                サーバーの選挙区や役職エリアを定義します。（例: 第1選挙区, 商業エリア等）
              </p>
              
              <div className="space-y-2">
                {districts.map((district, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={district}
                      onChange={e => updateDistrict(index, e.target.value)}
                      placeholder="選挙区名を入力"
                      className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                    <button
                      onClick={() => removeDistrict(index)}
                      disabled={districts.length === 1}
                      className="p-2 text-slate-400 hover:text-rose-500 disabled:opacity-30 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>

          {/* 右カラム：段階（ステージ）設定 */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                投票段階 (設問) の設定
              </h2>
              <button
                onClick={addStage}
                className="flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <ListPlus className="w-3.5 h-3.5" /> 段階を追加
              </button>
            </div>

            {stages.map((stage, sIndex) => (
              <GlassPanel key={stage.id} highlight className="p-5 sm:p-6 relative group overflow-visible">
                {/* 段階削除ボタン */}
                {stages.length > 1 && (
                  <button
                    onClick={() => removeStage(stage.id)}
                    className="absolute -right-3 -top-3 p-2 bg-rose-100 text-rose-600 rounded-full opacity-0 group-hover:opacity-100 transition shadow-sm border border-rose-200 hover:bg-rose-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <div className="mb-5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1 block">
                    STAGE {sIndex + 1}
                  </label>
                  <input
                    type="text"
                    value={stage.stageName}
                    onChange={e => updateStageName(stage.id, e.target.value)}
                    placeholder="段階名（例: 大統領選 1次投票）"
                    className="w-full text-lg font-bold bg-transparent border-b border-slate-200 pb-1 outline-none focus:border-amber-400 transition placeholder:text-slate-300"
                  />
                </div>

                {/* 選択肢リスト */}
                <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-slate-100">
                  {stage.options.map((option, oIndex) => (
                    <div key={option.id} className="relative rounded-xl border border-slate-100 bg-white/60 p-3 flex gap-3">
                      <div className="shrink-0 mt-1">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                          {oIndex + 1}
                        </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={option.title}
                          onChange={e => updateOption(stage.id, option.id, "title", e.target.value)}
                          placeholder="選択肢のタイトル（例: 候補者A）"
                          className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400"
                        />
                        <input
                          type="text"
                          value={option.description}
                          onChange={e => updateOption(stage.id, option.id, "description", e.target.value)}
                          placeholder="補足説明（任意）"
                          className="w-full bg-transparent text-xs text-slate-500 outline-none placeholder:text-slate-300"
                        />
                      </div>
                      <button
                        onClick={() => removeOption(stage.id, option.id)}
                        disabled={stage.options.length === 1}
                        className="shrink-0 p-1.5 text-slate-300 hover:text-rose-500 disabled:opacity-0 transition self-start"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => addOption(stage.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 transition mt-2 ml-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> 選択肢を追加
                  </button>
                </div>
              </GlassPanel>
            ))}

            {/* 保存ボタン */}
            <div className="pt-6 border-t border-slate-200">
              <button
                onClick={handleSaveForm}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 py-4 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-slate-900/20"
              >
                {isSaving ? (
                  "保存しています..."
                ) : (
                  <>
                    <Save className="w-4 h-4" /> フォームを保存してリンクを発行
                  </>
                )}
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}