import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Zap, Star, RefreshCw, Receipt } from "lucide-react";
import { useState } from "react";

const GRADE_COLORS: Record<string, string> = {
  Stock: "text-slate-400", Refined: "text-blue-400", Rare: "text-purple-400",
  Exotic: "text-pink-400", Legacy: "text-amber-400",
};
const GRADE_EMOJI: Record<string, string> = {
  Stock: "⚫", Refined: "🔵", Rare: "🟣", Exotic: "🌸", Legacy: "👑",
};

function timeAgo(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "щойно";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} хв тому`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} год тому`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} днів тому`;
  return date.toLocaleDateString("uk-UA");
}

export default function Transactions() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "sold" | "bought">("all");

  const { data: txns, isLoading, refetch } = trpc.market.getMyTransactions.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const filtered = (txns ?? []).filter((t: any) => filter === "all" || t.type === filter);

  // Stats
  const totalEarned = (txns ?? []).filter((t: any) => t.type === "sold").reduce((s: number, t: any) => s + (t.received ?? 0), 0);
  const totalSpent = (txns ?? []).filter((t: any) => t.type === "bought").reduce((s: number, t: any) => s + (t.price ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-6">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-base">Угоди</h1>
          <p className="text-xs text-slate-500">{txns?.length ?? 0} операцій</p>
        </div>
        <button onClick={() => refetch()} className="text-slate-400 hover:text-white p-2">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats cards */}
      <div className="px-4 mb-4 grid grid-cols-2 gap-2">
        <Card className="bg-[#0d2010] border-green-500/30 p-3 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-green-400" />
            <p className="text-[10px] text-slate-400 uppercase font-bold">Зароблено</p>
          </div>
          <p className="text-green-400 font-bold text-lg">+{totalEarned.toLocaleString()}₵</p>
        </Card>
        <Card className="bg-[#200d10] border-red-500/30 p-3 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
            <p className="text-[10px] text-slate-400 uppercase font-bold">Витрачено</p>
          </div>
          <p className="text-red-400 font-bold text-lg">-{totalSpent.toLocaleString()}₵</p>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="px-4 mb-3 flex gap-2">
        {[
          { id: "all", label: "Всі" },
          { id: "sold", label: "💰 Продав" },
          { id: "bought", label: "🛒 Купив" },
        ].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id as any)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${filter === t.id ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="px-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-semibold">Угод поки немає</p>
            <p className="text-slate-600 text-sm mt-1">Виставляй предмети на маркет або купуй</p>
            <Button onClick={() => navigate("/market")} className="mt-4 bg-purple-600 hover:bg-purple-700 rounded-xl">
              До маркету
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t: any) => {
              const isSale = t.type === "sold";
              const grade = t.itemGrade ?? "Stock";
              return (
                <Card key={t.id} className="bg-[#12121a] border-[#1e1e2e] p-3 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${isSale ? "bg-green-900/30" : "bg-red-900/30"}`}>
                      {GRADE_EMOJI[grade]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {isSale ? (
                          <ArrowDownLeft className="w-3 h-3 text-green-400 flex-shrink-0" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3 text-red-400 flex-shrink-0" />
                        )}
                        <p className="text-xs font-bold text-white truncate">{t.itemName}</p>
                        <span className={`text-[9px] font-bold ${GRADE_COLORS[grade]}`}>{grade}</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {isSale ? `Продано → ${t.otherUser}` : `Куплено у ${t.otherUser}`}
                      </p>
                      <p className="text-[9px] text-slate-600">{timeAgo(t.createdAt)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`font-bold text-sm flex items-center gap-1 ${isSale ? "text-green-400" : "text-red-400"}`}>
                        {t.currency === "coins" ? <Zap className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                        {isSale ? `+${t.received.toLocaleString()}` : `-${t.price.toLocaleString()}`}
                      </div>
                      {isSale && (
                        <p className="text-[9px] text-slate-500">комісія {t.fee}₵</p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
