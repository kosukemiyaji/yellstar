"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  orderBy,
  updateDoc,
  arrayUnion,
  addDoc
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  Briefcase, 
  CheckCircle2, 
  Wallet, 
  Search, 
  ArrowRightLeft,
  User as UserIcon,
  Coins,
  X,
  Send,
  MessageSquare,
  ChevronRight
} from "lucide-react";

interface Applicant {
  uid: string;
  name: string;
  status: "pending" | "accepted";
}

interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  clientId: string;
  clientName: string;
  workerId: string | null;
  workerName: string | null;
  status: "open" | "in_progress" | "completed";
  applicants: Applicant[];
  createdAt: any;
}

interface Message {
  id: string;
  senderName: string;
  text: string;
  createdAt: any;
}

export default function TasksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("ゲスト");
  const [bankBalance, setBalance] = useState<number>(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"browse" | "my_posts" | "create">("browse");

  // 詳細・チャットモーダル用
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  // 案件作成フォーム状態
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [processing, setProcessing] = useState(false);

  // スライドバー用（スワイプ完了度 0〜100）
  const [slideProgress, setSlideProgress] = useState(0);
  const [isSliding, setIsSliding] = useState(false);

  const router = useRouter();

  // 1. 認証 & ユーザー名・銀行残高・案件の取得
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // 銀行口座から表示名と残高を取得
        const bankRef = doc(db, "banks", currentUser.uid);
        const bankSnap = await getDoc(bankRef);
        if (bankSnap.exists()) {
          setUserName(bankSnap.data().accountName || "ユーザー");
          setBalance(bankSnap.data().balance || 0);
        }

        const unsubBank = onSnapshot(bankRef, (snap) => {
          if (snap.exists()) setBalance(snap.data().balance || 0);
        });

        // 案件一覧
        const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
        const unsubTasks = onSnapshot(q, (snap) => {
          const taskList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
          setTasks(taskList);
          setLoading(false);
        });

        return () => {
          unsubBank();
          unsubTasks();
        };
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // 2. 案件ごとのチャット監視
  useEffect(() => {
    if (!selectedTask) return;
    const msgQuery = query(
      collection(db, "tasks", selectedTask.id, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(msgQuery, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });
    return () => unsub();
  }, [selectedTask]);

  // 3. 案件作成（エスクロー）
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || processing) return;

    const rewardNum = parseInt(reward);
    if (isNaN(rewardNum) || rewardNum <= 0) return alert("正しい金額を入力してください");
    if (bankBalance < rewardNum) return alert("残高が不足しています");

    setProcessing(true);

    try {
      await runTransaction(db, async (transaction) => {
        const clientRef = doc(db, "banks", user.uid);
        const clientSnap = await transaction.get(clientRef);
        const clientData = clientSnap.data();
        if (!clientSnap.exists()) throw "口座が見つかりません";

        const newBalance = clientData.balance - rewardNum;
        const newHistory = [
          {
            id: Date.now(),
            type: "transfer_out",
            label: `案件預託: ${title}`,
            amount: -rewardNum,
            date: new Date().toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
          },
          ...(clientData.history || [])
        ];

        transaction.update(clientRef, { balance: newBalance, history: newHistory });

        const newTaskRef = doc(collection(db, "tasks"));
        transaction.set(newTaskRef, {
          title,
          description,
          reward: rewardNum,
          clientId: user.uid,
          clientName: userName,
          workerId: null,
          workerName: null,
          status: "open",
          applicants: [],
          createdAt: serverTimestamp(),
        });
      });

      alert("案件を公開しました（報酬をエスクローしました）");
      setTitle(""); setDescription(""); setReward("");
      setTab("browse");
    } catch (err) {
      console.error(err);
      alert("エラーが発生しました");
    } finally {
      setProcessing(false);
    }
  };

  // 4. 案件に応募する（スライド完了時）
  const handleApplyTask = async (taskId: string) => {
    if (!user) return;
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        applicants: arrayUnion({
          uid: user.uid,
          name: userName,
          status: "pending"
        })
      });
      alert("案件に応募しました！依頼主の承認をお待ちください。");
      setSlideProgress(0);
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
      alert("応募に失敗しました");
    }
  };

  // 5. 依頼主が応募者を承認する
  const handleAcceptApplicant = async (taskId: string, applicant: Applicant) => {
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        workerId: applicant.uid,
        workerName: applicant.name,
        status: "in_progress",
      });
      alert(`${applicant.name}さんを受託者に決定しました！チャットが開始できます。`);
    } catch (err) {
      console.error(err);
      alert("承認に失敗しました");
    }
  };

  // 6. 案件完了・送金処理
  const handleCompleteTask = async (task: Task) => {
    if (!user || !task.workerId || processing) return;
    if (!confirm(`${task.workerName}さんへの案件を完了し、報酬を振り込みますか？`)) return;

    setProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        const taskRef = doc(db, "tasks", task.id);
        const workerRef = doc(db, "banks", task.workerId!);
        
        const workerSnap = await transaction.get(workerRef);
        if (!workerSnap.exists()) throw "ワーカーの口座が見つかりません";

        const workerData = workerSnap.data();
        const newBalance = (workerData.balance || 0) + task.reward;
        
        const newHistory = [
          {
            id: Date.now(),
            type: "transfer_in",
            label: `報酬受取: ${task.title}`,
            amount: task.reward,
            date: new Date().toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
          },
          ...(workerData.history || [])
        ];

        transaction.update(workerRef, { balance: newBalance, history: newHistory });
        transaction.update(taskRef, { status: "completed" });
      });

      alert("送金が完了しました！お疲れ様でした。");
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
      alert("送金処理に失敗しました");
    } finally {
      setProcessing(false);
    }
  };

  // 7. チャットメッセージ送信
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newMessage.trim()) return;

    try {
      await addDoc(collection(db, "tasks", selectedTask.id, "messages"), {
        senderName: userName,
        text: newMessage,
        createdAt: serverTimestamp(),
      });
      setNewMessage("");
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      {/* 背景の淡いグラデーション装飾 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-24 w-80 h-80 bg-blue-50/50 rounded-full blur-3xl" />
      </div>

      {/* ヘッダー */}
      <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-2xl text-white shadow-md shadow-indigo-200">
              <Briefcase size={20} />
            </div>
            <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-indigo-700 to-blue-600 bg-clip-text text-transparent">
              Yellstar Tasks
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wallet Balance</span>
                <span className="text-sm font-black text-indigo-600 font-mono">¥ {bankBalance.toLocaleString()}</span>
             </div>
             <button onClick={() => router.push("/bank")} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-600">
                <Wallet size={20} />
             </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-6 py-8">
        {/* タブ切り替え */}
        <div className="flex gap-2 mb-8 bg-slate-200/50 p-1.5 rounded-2xl w-fit">
          {[
            { id: "browse", label: "案件を探す", icon: <Search size={14} /> },
            { id: "my_posts", label: "自分の依頼・受託", icon: <ArrowRightLeft size={14} /> },
            { id: "create", label: "依頼を作成", icon: <Plus size={14} /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === t.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "create" ? (
            /* --- 案件作成フォーム --- */
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto bg-white rounded-[2rem] border border-slate-200/80 p-8 shadow-xl shadow-slate-200/40"
            >
              <h2 className="text-xl font-bold mb-6 tracking-tight">新しい案件を依頼する</h2>
              <form onSubmit={handleCreateTask} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block">案件タイトル</label>
                  <input
                    type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                    placeholder="例: オリジナルアイコン作成、特設バナー制作など"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block">報酬金額 (¥)</label>
                  <div className="relative">
                    <input
                      type="number" value={reward} onChange={(e) => setReward(e.target.value)} required
                      placeholder="5000"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition pl-10"
                    />
                    <Coins size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block">依頼詳細・納期</label>
                  <textarea
                    rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required
                    placeholder="具体的な作業内容や納期を記入してください"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition resize-none"
                  />
                </div>
                <button
                  type="submit" disabled={processing}
                  className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition active:scale-[0.98] disabled:opacity-50"
                >
                  {processing ? "処理中..." : "案件を掲示する（エスクロー決済）"}
                </button>
              </form>
            </motion.div>
          ) : (
            /* --- 案件リスト（探す ＆ 自分の依頼） --- */
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {tasks
                .filter(t => {
                  if (tab === "browse") return t.status === "open";
                  if (tab === "my_posts") return t.clientId === user?.uid || t.workerId === user?.uid;
                  return true;
                })
                .map((task) => (
                  <motion.div
                    key={task.id} layout
                    onClick={() => setSelectedTask(task)}
                    className="group bg-white rounded-3xl border border-slate-200/80 p-6 hover:shadow-xl hover:shadow-slate-200/60 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          task.status === "open" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                          task.status === "in_progress" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {task.status === "open" ? "募集中" : task.status === "in_progress" ? "進行中" : "完了"}
                        </span>
                        <span className="text-lg font-black text-indigo-600 font-mono">¥{task.reward.toLocaleString()}</span>
                      </div>
                      <h3 className="font-bold text-base mb-2 group-hover:text-indigo-600 transition">{task.title}</h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-6 leading-relaxed">
                        {task.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                            <UserIcon size={12} />
                         </div>
                         <span className="text-xs font-bold text-slate-600">{task.clientName}</span>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 flex items-center gap-1 group-hover:translate-x-1 transition">
                        詳細を見る <ChevronRight size={14} />
                      </span>
                    </div>
                  </motion.div>
                ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- 案件詳細・スライド受託・チャット モーダル --- */}
        <AnimatePresence>
          {selectedTask && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              >
                {/* モーダルヘッダー */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                      報酬: ¥{selectedTask.reward.toLocaleString()}
                    </span>
                    <h2 className="text-xl font-bold mt-2 text-slate-900">{selectedTask.title}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">依頼主: {selectedTask.clientName}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedTask(null)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition text-slate-600"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* スクロールエリア */}
                <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 mb-2">案件の詳細</h4>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {selectedTask.description}
                    </p>
                  </div>

                  {/* ステータスが進行中 または 完了の場合：チャットを表示 */}
                  {(selectedTask.status === "in_progress" || selectedTask.status === "completed") && (
                    <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <MessageSquare size={14} className="text-indigo-600" />
                          案件専用チャット ({selectedTask.workerName || "受託者未定"})
                        </span>
                        {selectedTask.clientId === user?.uid && selectedTask.status === "in_progress" && (
                          <button
                            onClick={() => handleCompleteTask(selectedTask)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition shadow-sm"
                          >
                            完了して報酬を送金
                          </button>
                        )}
                      </div>

                      {/* チャットメッセージ一覧 */}
                      <div className="h-44 overflow-y-auto space-y-3 p-2 bg-slate-50 rounded-xl">
                        {messages.length === 0 ? (
                          <p className="text-center text-xs text-slate-400 py-8">まだメッセージはありません</p>
                        ) : (
                          messages.map((m) => (
                            <div key={m.id} className={`flex flex-col ${m.senderName === userName ? "items-end" : "items-start"}`}>
                              <span className="text-[10px] text-slate-400 mb-0.5">{m.senderName}</span>
                              <div className={`px-4 py-2 rounded-2xl text-xs max-w-[80%] ${
                                m.senderName === userName ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                              }`}>
                                {m.text}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* メッセージ入力 */}
                      {selectedTask.status === "in_progress" && (
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                          <input
                            type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="メッセージを入力..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <button type="submit" className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition">
                            <Send size={16} />
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {/* 依頼主の画面：応募者確認エリア（募集中のみ） */}
                  {selectedTask.clientId === user?.uid && selectedTask.status === "open" && (
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4">
                      <h4 className="text-xs font-bold text-indigo-900 mb-3">応募者一覧</h4>
                      {selectedTask.applicants?.length === 0 ? (
                        <p className="text-xs text-slate-400">まだ応募者はいません</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedTask.applicants?.map((app) => (
                            <div key={app.uid} className="flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-100">
                              <span className="text-xs font-bold text-slate-800">{app.name} さん</span>
                              <button
                                onClick={() => handleAcceptApplicant(selectedTask.id, app)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition"
                              >
                                この人に決定する
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* モーダル下部：ワーカー用のスライド受託バー（自分が依頼主ではなく、募集中かつ未応募の場合） */}
                {selectedTask.clientId !== user?.uid && selectedTask.status === "open" && (
                  <div className="pt-6 border-t border-slate-100 mt-4">
                    {!selectedTask.applicants?.some(a => a.uid === user?.uid) ? (
                      <div className="relative h-12 bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center select-none border border-slate-200">
                        {/* スライドで動かせるボタン（シミュレーション用タップ/スライド） */}
                        <div 
                          onClick={() => handleApplyTask(selectedTask.id)}
                          className="absolute left-1 top-1 bottom-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl px-6 flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
                        >
                          <span>👉 スワイプして受託する</span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 tracking-wider pl-24">
                          タップまたはスライドで応募
                        </span>
                      </div>
                    ) : (
                      <div className="text-center text-xs font-bold text-amber-600 bg-amber-50 py-3 rounded-xl border border-amber-100">
                        応募済みです。依頼主の承認をお待ちください。
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}