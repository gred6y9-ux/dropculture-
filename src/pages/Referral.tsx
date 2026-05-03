import { useState } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, Copy, Share2, Users, Coins, Trophy, Gift } from "lucide-react";
import { toast } from "@/components/Toast";

export default function Referral() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"my" | "top">("my");

  const { data: stats, isLoading } = trpc.referral.getMyStats.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: leaderboard } = trpc.referral.getLeaderboard.useQuery(undefined, {
    enabled: isAuthenticated && tab === "top",
  });

  const copyLink = () => {
    if (!stats?.myLink) return;
    navigator.clipboard.writeText(stats.myLink);
    toast.success("✅ Скопійовано!", "Тепер поділись з другом");
  };

  const share = () => {
    if (!stats?.myLink) return;
    const text = `🎮 Я граю в DropCulture — крута Telegram гра з колекційними картками. Заходь!\n\n${stats.myLink}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(stats.myLink)}&text=${encodeURIComponent(text)}`);
    } else {
      navigator.share?.({ url: stats.myLink, text }).catch(() => copyLink());
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-6">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-base">Запроси друзів</h1>
          <p className="text-xs text-slate-500">Заробляй разом</p>
        </div>
      </div>

      <div className="px-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab("my")}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ${tab === "my" ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
            👥 Мої реферали
          </button>
          <button onClick={() => setTab("top")}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ${tab === "top" ? "bg-amber-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
            🏆 Топ
          </button>
        </div>

        {tab === "my" && stats && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <Card className="bg-gradient-to-br from-[#0f1a28] to-[#12121a] border-blue-500/20 p-3 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-blue-400" />
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Друзів</p>
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalReferrals}</p>
              </Card>
              <Card className="bg-gradient-to-br from-[#1a0f28] to-[#12121a] border-purple-500/20 p-3 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="w-4 h-4 text-yellow-400" />
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Зароблено</p>
                </div>
                <p className="text-3xl font-bold text-yellow-400">{stats.totalEarned.toLocaleString()}</p>
              </Card>
            </div>

            {/* Reward info */}
            <Card className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/30 p-4 rounded-2xl">
              <p className="font-bold text-white mb-3 flex items-center gap-2">
                <Gift className="w-4 h-4 text-purple-400" /> Що ти отримуєш
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">→</span>
                  <span className="text-slate-300">
                    <span className="text-white font-bold">{stats.bonusPerReferral}₵</span> миттєво коли друг приєднається
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">→</span>
                  <span className="text-slate-300">
                    <span className="text-white font-bold">{stats.commissionPct}%</span> від кожної покупки друга назавжди
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">→</span>
                  <span className="text-slate-300">
                    Друг отримує <span className="text-white font-bold">{stats.bonusForFriend}₵</span> бонус
                  </span>
                </div>
              </div>
            </Card>

            {/* Share buttons */}
            <Card className="bg-[#12121a] border-[#1e1e2e] p-3 rounded-2xl">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Твоє посилання</p>
              <div className="bg-[#0a0a0f] border border-[#2a2a3e] rounded-xl px-3 py-2 mb-3">
                <p className="text-xs text-purple-300 font-mono truncate">{stats.myLink}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={copyLink} className="bg-[#1e1e2e] hover:bg-[#2a2a3e] rounded-xl text-sm">
                  <Copy className="w-4 h-4 mr-1.5" />Копіювати
                </Button>
                <Button onClick={share} className="bg-purple-600 hover:bg-purple-700 rounded-xl text-sm">
                  <Share2 className="w-4 h-4 mr-1.5" />Поділитись
                </Button>
              </div>
            </Card>

            {/* Referrals list */}
            {stats.referrals.length > 0 ? (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Друзі що приєднались</p>
                <div className="space-y-1.5">
                  {stats.referrals.map((r: any) => (
                    <Card key={r.id} className="bg-[#12121a] border-[#1e1e2e] p-3 rounded-xl flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center font-bold text-purple-300">
                        {r.firstName?.[0] ?? r.username?.[0] ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-bold truncate">{r.firstName ?? r.username}</p>
                        <p className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleDateString("uk-UA")}</p>
                      </div>
                      {r.totalEarned > 0 && (
                        <div className="text-right">
                          <p className="text-yellow-400 font-bold text-sm">+{r.totalEarned.toLocaleString()}</p>
                          <p className="text-[9px] text-slate-500">з продажів</p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card className="bg-[#12121a] border-[#1e1e2e] p-6 rounded-2xl text-center">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Поки немає рефералів</p>
                <p className="text-slate-600 text-xs mt-1">Поділись посиланням!</p>
              </Card>
            )}
          </div>
        )}

        {tab === "top" && (
          <div className="space-y-2">
            {!leaderboard || leaderboard.length === 0 ? (
              <Card className="bg-[#12121a] border-[#1e1e2e] p-6 rounded-2xl text-center">
                <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Поки нікого в рейтингу</p>
                <p className="text-slate-600 text-xs mt-1">Будь першим!</p>
              </Card>
            ) : (
              leaderboard.map((r: any) => (
                <Card key={r.userId} className={`bg-[#12121a] border p-3 rounded-2xl flex items-center gap-3 ${
                  r.rank === 1 ? "border-amber-500/40" :
                  r.rank === 2 ? "border-slate-400/40" :
                  r.rank === 3 ? "border-orange-700/40" : "border-[#1e1e2e]"
                }`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                    r.rank === 1 ? "bg-amber-500/30 text-amber-300" :
                    r.rank === 2 ? "bg-slate-500/30 text-slate-200" :
                    r.rank === 3 ? "bg-orange-700/30 text-orange-300" :
                    "bg-[#1e1e2e] text-slate-400"
                  }`}>
                    {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `#${r.rank}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-bold truncate">{r.firstName ?? r.username}</p>
                    <p className="text-[10px] text-slate-500">@{r.username ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-purple-400 font-bold text-sm">{r.referralCount}</p>
                    <p className="text-[9px] text-slate-500">рефералів</p>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
