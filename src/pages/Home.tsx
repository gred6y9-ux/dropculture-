import { useTelegramAuth } from "@/providers/telegram-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router";
import { Package, Backpack, Store, Sparkles, TrendingUp, Zap, Star, Gift, Flame, ChevronRight, RotateCcw, Receipt, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

const GRADE_COLORS: Record<string, string> = {
  Stock: "bg-slate-500", Refined: "bg-blue-500", Rare: "bg-purple-500", Exotic: "bg-pink-500", Legacy: "bg-amber-500",
};
const GRADE_TEXT: Record<string, string> = {
  Stock: "text-slate-400", Refined: "text-blue-400", Rare: "text-purple-400", Exotic: "text-pink-400", Legacy: "text-amber-400",
};

export default function Home() {
  const { user, isLoading, isAuthenticated, login } = useTelegramAuth();
  const navigate = useNavigate();

  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const { data: dailyStatus, refetch: refetchDaily } = trpc.game.checkDailyStatus.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const { data: wheelStatus } = trpc.wheel.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const { data: adminStatus } = trpc.admin.whoami.useQuery(undefined, { enabled: isAuthenticated, retry: false });

  const claimDaily = trpc.game.getDailyPack.useMutation({
    onSuccess: (data) => {
      refetchDaily(); refetchProfile();
      toast.success("🎁 Щоденний пак!", `Streak ${data.streak} · +${data.bonusCoins} монет`);
    },
    onError: (err) => toast.error("Зачекай", err.message),
  });

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) { tg.ready(); tg.expand(); }
  }, []);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isAuthenticated) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] p-6">
      <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-purple-500/30">
        <Sparkles className="w-12 h-12 text-white" />
      </div>
      <h1 className="text-4xl font-bold text-white mb-1">DropCulture</h1>
      <p className="text-slate-500 mb-8 text-sm">Відкривай · Колекціонуй · Торгуй</p>
      <Button onClick={login} className="w-full max-w-xs bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-6 rounded-2xl text-lg">
        Увійти через Telegram
      </Button>
    </div>
  );

  const displayUser = profile?.user ?? user;
  const stats = profile?.stats;
  const canSpin = wheelStatus?.canSpin ?? false;
  const wheelHours = wheelStatus?.hoursRemaining ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-lg font-bold shadow-lg shadow-purple-500/20">
              {displayUser?.firstName?.[0] ?? displayUser?.username?.[0] ?? "?"}
            </div>
            <div>
              <p className="font-bold text-white text-sm flex items-center gap-1.5">
                {displayUser?.firstName ?? displayUser?.username ?? "Гравець"}
                {adminStatus?.isAdmin && (
                  <button onClick={() => navigate("/admin")}
                    className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-md p-0.5 transition" title="Admin">
                    <Shield className="w-3 h-3" />
                  </button>
                )}
              </p>
              <p className="text-xs text-slate-500">@{displayUser?.username ?? "..."}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="bg-[#1a1a28] rounded-xl px-3 py-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-yellow-400 font-bold text-sm">{(displayUser?.coins ?? 0).toLocaleString()}</span>
            </div>
            <button onClick={() => navigate("/shop")}
              className="bg-[#1a1a28] hover:bg-[#252535] rounded-xl px-3 py-2 flex items-center gap-1.5 transition-all">
              <Star className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-purple-400 font-bold text-sm">{displayUser?.stars ?? 0}</span>
              <span className="text-purple-400 font-bold text-base ml-0.5 leading-none">+</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="bg-[#12121a] border-[#1e1e2e] p-3 text-center rounded-2xl">
            <p className="text-xl font-bold text-white">{stats?.totalItems ?? 0}</p>
            <p className="text-xs text-slate-500">Предметів</p>
          </Card>
          <Card className="bg-[#12121a] border-[#1e1e2e] p-3 text-center rounded-2xl">
            <p className="text-xl font-bold text-yellow-400">{(stats?.totalValue ?? 0).toLocaleString()}</p>
            <p className="text-xs text-slate-500">Вартість</p>
          </Card>
          <Card className="bg-[#12121a] border-[#1e1e2e] p-3 text-center rounded-2xl">
            <p className="text-xl font-bold text-amber-400">{stats?.legacyCount ?? 0}</p>
            <p className="text-xs text-slate-500">Legacy</p>
          </Card>
        </div>

        {/* Open Pack CTA */}
        <Button onClick={() => navigate("/pack-open")}
          className="w-full h-16 text-lg font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:opacity-90 rounded-2xl shadow-lg shadow-purple-500/20">
          <Package className="w-6 h-6 mr-2" /> Відкрити пак
        </Button>

        {/* Quick menu */}
        <div className="grid grid-cols-2 gap-2">
          <Card onClick={() => navigate("/inventory")}
            className="bg-[#12121a] border-[#1e1e2e] hover:bg-[#1a1a28] hover:border-purple-500/30 p-4 rounded-2xl cursor-pointer flex items-center gap-3 active:scale-95 transition-all">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Backpack className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Інвентар</p>
              <p className="text-xs text-slate-500">{stats?.totalItems ?? 0} предметів</p>
            </div>
          </Card>
          <Card onClick={() => navigate("/market")}
            className="bg-[#12121a] border-[#1e1e2e] hover:bg-[#1a1a28] hover:border-blue-500/30 p-4 rounded-2xl cursor-pointer flex items-center gap-3 active:scale-95 transition-all">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Маркет</p>
              <p className="text-xs text-slate-500">Торгівля</p>
            </div>
          </Card>
        </div>

        {/* Daily + Wheel row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Daily */}
          <Card className="bg-gradient-to-br from-[#0f1a28] to-[#12121a] border-blue-500/20 rounded-2xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Gift className="w-4 h-4 text-blue-400" />
              <p className="font-bold text-white text-xs">Щоденний пак</p>
            </div>
            {/* Status text */}
            {dailyStatus?.canClaim ? (
              <p className="text-[10px] text-green-400 mb-1.5 font-semibold">✓ Готовий до отримання</p>
            ) : (
              <p className="text-[10px] text-slate-500 mb-1.5">⏱ через {dailyStatus?.hoursRemaining ?? "..."} год</p>
            )}
            {/* Streak with day labels */}
            <div className="mb-2">
              <div className="flex justify-between mb-0.5">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d, i) => (
                  <span key={d} className={`text-[8px] font-bold ${i < (dailyStatus?.streak ?? 0) ? "text-purple-400" : "text-slate-600"}`}>{d}</span>
                ))}
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full ${i < (dailyStatus?.streak ?? 0) ? "bg-purple-500" : "bg-[#1e1e2e]"}`} />
                ))}
              </div>
              <p className="text-[8px] text-slate-500 mt-0.5">Streak {dailyStatus?.streak ?? 0} днів · +{Math.min((dailyStatus?.streak ?? 0) * 30, 300)}₵</p>
            </div>
            <Button onClick={() => claimDaily.mutate()} disabled={!dailyStatus?.canClaim || claimDaily.isPending} size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl text-xs font-bold h-8">
              {dailyStatus?.canClaim ? "🎁 Забрати!" : `⏱ ${dailyStatus?.hoursRemaining ?? 0}г`}
            </Button>
          </Card>

          {/* Wheel */}
          <Card onClick={() => navigate("/wheel")}
            className="bg-gradient-to-br from-[#180f28] to-[#12121a] border-purple-500/20 rounded-2xl p-3 cursor-pointer active:scale-95 transition-all hover:border-purple-500/40">
            <div className="flex items-center gap-2 mb-2">
              <RotateCcw className="w-4 h-4 text-purple-400" />
              <p className="font-bold text-white text-xs">Колесо фортуни</p>
            </div>
            <p className="text-xs text-slate-500 mb-2">50–1000₵ · Предмети</p>
            <div className={`w-full h-8 rounded-xl flex items-center justify-center text-xs font-bold ${canSpin ? "bg-purple-600 text-white" : "bg-[#1e1e2e] text-slate-500"}`}>
              {canSpin ? "🎡 Крутити!" : `⏱ ${wheelHours}г`}
            </div>
          </Card>
        </div>

        {/* Battle Pass teaser */}
        <Card onClick={() => navigate("/battle-pass")}
          className="bg-gradient-to-r from-[#1a0f0a] to-[#12121a] border-orange-500/20 rounded-2xl p-4 cursor-pointer active:scale-95 transition-all hover:border-orange-500/30 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
            <Flame className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-white text-sm">Battle Pass · Сезон 1</p>
            <p className="text-xs text-slate-500">50 рівнів · Ексклюзивні нагороди</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </Card>

        {/* Trade-Up + Collections row */}
        <div className="grid grid-cols-2 gap-2">
          <Card onClick={() => navigate("/trade-up")}
            className="bg-gradient-to-br from-[#1a0f0a] to-[#12121a] border-orange-500/20 rounded-2xl p-3 cursor-pointer active:scale-95 transition-all hover:border-orange-500/30 flex items-center gap-2.5">
            <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Flame className="w-4 h-4 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-xs">Trade-Up</p>
              <p className="text-[10px] text-slate-500">5 → 1 вищого</p>
            </div>
          </Card>

          <Card onClick={() => navigate("/transactions")}
            className="bg-gradient-to-br from-[#0f1a0a] to-[#12121a] border-green-500/20 rounded-2xl p-3 cursor-pointer active:scale-95 transition-all hover:border-green-500/30 flex items-center gap-2.5">
            <div className="w-9 h-9 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Receipt className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-xs">Угоди</p>
              <p className="text-[10px] text-slate-500">Історія</p>
            </div>
          </Card>
        </div>

        {/* Referral CTA */}
        <Card onClick={() => navigate("/referral")}
          className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border-purple-500/30 rounded-2xl p-4 cursor-pointer active:scale-95 transition-all hover:border-purple-500/50 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/30 rounded-xl flex items-center justify-center text-xl">
            🎁
          </div>
          <div className="flex-1">
            <p className="font-bold text-white text-sm">Запроси друга — отримай 500₵</p>
            <p className="text-xs text-slate-400">Друг отримує 200₵ + 1% від його покупок назавжди</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </Card>

        {/* Collections progress */}
        <CollectionsProgress />

        {/* Trending */}
        <div>
          <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-green-400" /> Trending
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { name: "Eternal Flame", grade: "Legacy",  price: 12500, change: "+12%", emoji: "👑", bg: "from-amber-700 to-amber-900",   border: "border-amber-500/40" },
              { name: "Abyss Eye",     grade: "Legacy",  price: 18700, change: "+8%",  emoji: "👑", bg: "from-amber-700 to-amber-900",   border: "border-amber-500/40" },
              { name: "Plasma Cage",   grade: "Exotic",  price: 3400,  change: "+5%",  emoji: "🌸", bg: "from-pink-700 to-pink-900",     border: "border-pink-500/40"  },
              { name: "Nebula Heart",  grade: "Rare",    price: 950,   change: "+3%",  emoji: "🟣", bg: "from-purple-700 to-purple-900", border: "border-purple-500/40"},
              { name: "Static Core",   grade: "Refined", price: 120,   change: "+1%",  emoji: "🔵", bg: "from-blue-700 to-blue-900",     border: "border-blue-500/40"  },
              { name: "Prism Light",   grade: "Exotic",  price: 2800,  change: "+7%",  emoji: "🌸", bg: "from-pink-700 to-pink-900",     border: "border-pink-500/40"  },
            ].map((item, i) => (
              <div key={i} className={`bg-gradient-to-br ${item.bg} border ${item.border} rounded-2xl overflow-hidden`}>
                <div className="p-2.5 flex flex-col h-full">
                  <div className="text-2xl mb-1.5 text-center">{item.emoji}</div>
                  <p className="text-[10px] font-bold text-white text-center leading-tight mb-1 line-clamp-2">{item.name}</p>
                  <p className={`text-[8px] ${GRADE_TEXT[item.grade]} text-center font-semibold mb-1.5`}>{item.grade}</p>
                  <div className="mt-auto">
                    <p className="text-[10px] font-bold text-yellow-400 text-center">{item.price.toLocaleString()}₵</p>
                    <p className="text-[9px] text-green-400 text-center">{item.change}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0d0d16]/95 backdrop-blur-sm border-t border-[#1e1e2e] px-4 py-3">
        <div className="flex justify-around">
          {[
            { emoji: "📦", label: "Паки",    action: () => navigate("/pack-open") },
            { emoji: "🎒", label: "Інвентар", action: () => navigate("/inventory") },
            { emoji: "🛒", label: "Маркет",   action: () => navigate("/market") },
            { emoji: "🎡", label: "Колесо",   action: () => navigate("/wheel") },
            { emoji: "🔥", label: "Battle Pass", action: () => navigate("/battle-pass") },
          ].map(({ emoji, label, action }) => (
            <button key={label} onClick={action} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors">
              <span className="text-lg">{emoji}</span>
              <span className="text-[9px]">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Collections Progress Component ──────────────────────────────
function CollectionsProgress() {
  const navigate = useNavigate();
  const { data: collections } = trpc.game.getCollectionsProgress.useQuery(undefined, { retry: false });
  const active = (collections ?? []).filter((c: any) => c.totalCount > 0);

  if (active.length === 0) return null;

  const GRADE_EMOJI: Record<string, string> = {
    Stock: "⚫", Refined: "🔵", Rare: "🟣", Exotic: "🌸", Legacy: "👑",
  };

  return (
    <div>
      <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm">
        🎯 Колекції
      </h3>
      <div className="space-y-2">
        {active.map((c: any) => {
          const pct = c.totalCount > 0 ? (c.ownedCount / c.totalCount) * 100 : 0;
          const isComplete = c.ownedCount === c.totalCount;
          // Find missing items preview
          const missing = (c.templates ?? []).filter((t: any) => !t.owned).slice(0, 5);
          return (
            <Card key={c.id}
              onClick={() => navigate("/inventory")}
              className={`bg-[#12121a] border-[#1e1e2e] p-3 rounded-2xl cursor-pointer active:scale-95 transition-all ${
                isComplete ? "border-amber-500/40" : "hover:border-purple-500/30"
              }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate flex items-center gap-1">
                    {c.name}
                    {isComplete && <span className="text-amber-400">✨</span>}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{c.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${isComplete ? "text-amber-400" : "text-white"}`}>
                    {c.ownedCount}/{c.totalCount}
                  </p>
                  <p className="text-[9px] text-slate-500">{pct.toFixed(0)}%</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full transition-all ${
                  isComplete ? "bg-gradient-to-r from-amber-400 to-yellow-500" :
                  "bg-gradient-to-r from-purple-500 to-pink-500"
                }`} style={{ width: `${pct}%` }} />
              </div>
              {/* Missing items preview */}
              {!isComplete && missing.length > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[9px] text-slate-500">Шукай:</span>
                  {missing.map((m: any, i: number) => (
                    <span key={i} className="text-[9px] text-slate-400" title={m.name}>
                      {GRADE_EMOJI[m.grade] ?? "•"}
                    </span>
                  ))}
                  {c.totalCount - c.ownedCount > 5 && (
                    <span className="text-[9px] text-slate-600">+{c.totalCount - c.ownedCount - 5}</span>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
