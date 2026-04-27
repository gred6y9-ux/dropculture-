import { useTelegramAuth } from "@/providers/telegram-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router";
import { Package, Backpack, Store, Sparkles, TrendingUp, Zap, RotateCcw, Star, Trophy, Gift, Flame, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

const GRADE_COLORS: Record<string, string> = {
  Stock: "bg-slate-500", Refined: "bg-blue-500", Rare: "bg-purple-500",
  Exotic: "bg-pink-500", Legacy: "bg-amber-500",
};
const GRADE_TEXT: Record<string, string> = {
  Stock: "text-slate-400", Refined: "text-blue-400", Rare: "text-purple-400",
  Exotic: "text-pink-400", Legacy: "text-amber-400",
};

const ALL_PACKS = [
  { id: "starter",   emoji: "🌑", name: "Starter Pack",   cost: 150,  currency: "coins", items: 3, desc: "Для початківців",   color: "from-slate-600 to-slate-800",   rare: 5,  exotic: 0,   legacy: 0   },
  { id: "standard",  emoji: "💎", name: "Standard Pack",  cost: 600,  currency: "coins", items: 5, desc: "Збалансований",    color: "from-purple-700 to-blue-800",   rare: 15, exotic: 5,   legacy: 0   },
  { id: "premium",   emoji: "✨", name: "Premium Pack",   cost: 2500, currency: "coins", items: 5, desc: "Гарантований Rare", color: "from-pink-700 to-purple-800",   rare: 35, exotic: 20,  legacy: 5   },
  { id: "elite",     emoji: "🔮", name: "Elite Pack",     cost: 6000, currency: "coins", items: 5, desc: "Топ шанси",        color: "from-violet-700 to-pink-700",   rare: 25, exotic: 40,  legacy: 10  },
  { id: "vip",       emoji: "⭐", name: "VIP Pack",       cost: 50,   currency: "stars", items: 5, desc: "Rare+ гарантовано", color: "from-amber-600 to-yellow-700",  rare: 45, exotic: 28,  legacy: 7   },
  { id: "legendary", emoji: "🔥", name: "Legendary",      cost: 200,  currency: "stars", items: 5, desc: "Exotic+ гарантовано", color: "from-orange-600 to-red-700", rare: 35, exotic: 50,  legacy: 15  },
  { id: "mythic",    emoji: "👑", name: "Mythic Drop",    cost: 500,  currency: "stars", items: 1, desc: "LEGACY 100%",      color: "from-amber-500 to-yellow-500",  rare: 0,  exotic: 0,   legacy: 100 },
];

export default function Home() {
  const { user, isLoading, isAuthenticated, login } = useTelegramAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"home" | "shop">("home");
  const [isSpinning, setIsSpinning] = useState(false);

  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const { data: dailyStatus, refetch: refetchDaily } = trpc.game.checkDailyStatus.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const { data: wheelStatus, refetch: refetchWheel } = trpc.wheel.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });

  const claimDaily = trpc.game.getDailyPack.useMutation({
    onSuccess: (data) => {
      refetchDaily(); refetchProfile();
      toast.success(`🎁 Пак відкрито!`, `Streak ${data.streak} днів · +${data.bonusCoins} монет`);
    },
    onError: (err) => toast.error("Не вдалось", err.message),
  });

  const spinWheel = trpc.wheel.spin.useMutation({
    onSuccess: (data) => {
      setIsSpinning(false);
      refetchWheel(); refetchProfile();
      toast.success("🎡 " + data.rewardDescription, "Колесо фортуни");
    },
    onError: (err) => { setIsSpinning(false); toast.error("Зачекай", err.message); },
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
  const coinPacks = ALL_PACKS.filter(p => p.currency === "coins");
  const starPacks = ALL_PACKS.filter(p => p.currency === "stars");

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-lg font-bold shadow-lg">
              {displayUser?.firstName?.[0] ?? displayUser?.username?.[0] ?? "?"}
            </div>
            <div>
              <p className="font-bold text-white text-sm">{displayUser?.firstName ?? displayUser?.username ?? "Гравець"}</p>
              <p className="text-xs text-slate-500">@{displayUser?.username ?? "..."}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="bg-[#1a1a28] rounded-xl px-3 py-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-yellow-400 font-bold text-sm">{(displayUser?.coins ?? 0).toLocaleString()}</span>
            </div>
            <div className="bg-[#1a1a28] rounded-xl px-3 py-2 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-purple-400 font-bold text-sm">{displayUser?.stars ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 mb-4 gap-2">
        {(["home", "shop"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeTab === tab ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "bg-[#12121a] text-slate-400"}`}>
            {tab === "home" ? "🏠 Головна" : "🛒 Магазин"}
          </button>
        ))}
      </div>

      {/* ── HOME TAB ── */}
      {activeTab === "home" && (
        <div className="px-4 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Предметів", value: stats?.totalItems ?? 0, color: "text-white" },
              { label: "Вартість", value: (stats?.totalValue ?? 0).toLocaleString(), color: "text-yellow-400" },
              { label: "Legacy", value: stats?.legacyCount ?? 0, color: "text-amber-400" },
            ].map(s => (
              <Card key={s.label} className="bg-[#12121a] border-[#1e1e2e] p-3 text-center rounded-2xl">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Wheel of Fortune */}
          <Card className="bg-gradient-to-br from-[#180f28] to-[#12121a] border-purple-500/25 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/30 flex-shrink-0 ${isSpinning ? "animate-spin" : ""}`}>
                🎡
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">Колесо фортуни</p>
                <p className="text-xs text-slate-400">50–1000 монет · Предмети · Раз на 12 год</p>
                {!wheelStatus?.canSpin && (wheelStatus?.hoursRemaining ?? 0) > 0 && (
                  <p className="text-xs text-purple-400 mt-0.5">⏱ Наступне через {wheelStatus?.hoursRemaining} год</p>
                )}
              </div>
              <Button
                onClick={() => { if (!wheelStatus?.canSpin || isSpinning) return; setIsSpinning(true); spinWheel.mutate(); }}
                disabled={!wheelStatus?.canSpin || isSpinning}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 disabled:opacity-40 rounded-xl text-xs font-bold px-4 flex-shrink-0">
                {isSpinning ? "🎡" : wheelStatus?.canSpin ? "Крути!" : `${wheelStatus?.hoursRemaining ?? "..."}г`}
              </Button>
            </div>
          </Card>

          {/* Daily Pack */}
          <Card className="bg-gradient-to-br from-[#0f1a28] to-[#12121a] border-blue-500/25 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">🎁</div>
                <div>
                  <p className="font-bold text-white text-sm">Щоденний пак</p>
                  <p className="text-xs text-slate-400">{dailyStatus?.canClaim ? "Готовий до відкриття!" : `Через ${dailyStatus?.hoursRemaining ?? 0} год`}</p>
                  <div className="flex gap-0.5 mt-1.5">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className={`h-1 rounded-full transition-all ${i < (dailyStatus?.streak ?? 0) ? "w-4 bg-purple-500" : "w-3 bg-[#1e1e2e]"}`} />
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={() => claimDaily.mutate()} disabled={!dailyStatus?.canClaim || claimDaily.isPending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl font-bold">
                {claimDaily.isPending ? "..." : "Взяти"}
              </Button>
            </div>
          </Card>

          {/* Open Pack CTA */}
          <Button onClick={() => navigate("/pack-open")}
            className="w-full h-14 text-base font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:opacity-90 rounded-2xl shadow-lg shadow-purple-500/20">
            <Package className="w-5 h-5 mr-2" /> Відкрити пак
          </Button>

          {/* Nav Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Backpack, label: "Інвентар", path: "/inventory", color: "text-purple-400", border: "hover:border-purple-500/30" },
              { icon: Store, label: "Маркет", path: "/market", color: "text-blue-400", border: "hover:border-blue-500/30" },
            ].map(({ icon: Icon, label, path, color, border }) => (
              <Button key={path} variant="outline" onClick={() => navigate(path)}
                className={`h-16 bg-[#12121a] border-[#1e1e2e] hover:bg-[#1a1a28] ${border} flex flex-col items-center gap-1.5 rounded-2xl`}>
                <Icon className={`w-5 h-5 ${color}`} />
                <span className="text-xs text-slate-300">{label}</span>
              </Button>
            ))}
          </div>

          {/* Trending */}
          <div>
            <h3 className="font-bold text-white mb-2 flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-green-400" /> Trending
            </h3>
            {[{ name: "Eternal Flame", grade: "Legacy", price: 12500, change: "+12%" },
              { name: "Abyss Eye", grade: "Legacy", price: 18700, change: "+8%" },
              { name: "Plasma Cage", grade: "Exotic", price: 3400, change: "+5%" }].map((item, i) => (
              <Card key={i} className="bg-[#12121a] border-[#1e1e2e] p-3 flex items-center justify-between mb-2 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-8 rounded-full ${GRADE_COLORS[item.grade]}`} />
                  <div>
                    <p className="text-sm font-medium text-white">{item.name}</p>
                    <p className={`text-xs ${GRADE_TEXT[item.grade]}`}>{item.grade}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{item.price.toLocaleString()}</p>
                  <p className="text-xs text-green-400">{item.change}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── SHOP TAB ── */}
      {activeTab === "shop" && (
        <div className="px-4 space-y-4">

          {/* Coins packs */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-yellow-400" />
              <h3 className="font-bold text-white text-sm">Паки за монети</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {coinPacks.map(pack => {
                const canAfford = (displayUser?.coins ?? 0) >= pack.cost;
                return (
                  <div key={pack.id} className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl overflow-hidden">
                    {/* Pack visual */}
                    <div className={`bg-gradient-to-br ${pack.color} p-4 flex flex-col items-center relative`}>
                      <span className="text-3xl mb-1">{pack.emoji}</span>
                      <p className="text-white font-bold text-xs text-center">{pack.name}</p>
                      <p className="text-white/60 text-[10px] text-center mt-0.5">{pack.items} предметів</p>
                    </div>
                    {/* Info */}
                    <div className="p-2.5 space-y-1.5">
                      {/* Chances */}
                      <div className="flex flex-wrap gap-1">
                        {pack.rare > 0 && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-lg font-bold">R {pack.rare}%</span>}
                        {pack.exotic > 0 && <span className="text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-lg font-bold">E {pack.exotic}%</span>}
                        {pack.legacy > 0 && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-lg font-bold">L {pack.legacy}%</span>}
                      </div>
                      {/* Price */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-yellow-400" />
                          <span className="text-yellow-400 font-bold text-xs">{pack.cost.toLocaleString()}</span>
                        </div>
                        <Button size="sm" onClick={() => navigate(`/pack-open?type=${pack.id}`)} disabled={!canAfford}
                          className={`h-6 text-[10px] px-2 rounded-lg font-bold ${canAfford ? "bg-purple-600 hover:bg-purple-700" : "bg-[#1e1e2e] text-slate-600 cursor-not-allowed"}`}>
                          {canAfford ? "Відкрити" : "Мало"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stars packs */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-white text-sm">VIP паки за Stars</h3>
              <span className="text-xs text-slate-500 ml-auto">⭐ = реальні гроші</span>
            </div>
            <div className="space-y-2">
              {starPacks.map(pack => (
                <div key={pack.id} className={`bg-gradient-to-r ${pack.color} rounded-2xl p-0.5`}>
                  <div className="bg-[#0d0d16] rounded-[14px] p-3 flex items-center gap-3">
                    <span className="text-3xl">{pack.emoji}</span>
                    <div className="flex-1">
                      <p className="font-bold text-white text-sm">{pack.name}</p>
                      <p className="text-xs text-slate-400">{pack.desc}</p>
                      <div className="flex gap-1 mt-1">
                        {pack.exotic > 0 && <span className="text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-lg font-bold">E {pack.exotic}%</span>}
                        {pack.legacy > 0 && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-lg font-bold">L {pack.legacy}%</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 mb-1.5">
                        <Star className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-purple-400 font-bold text-sm">{pack.cost}</span>
                      </div>
                      <Button size="sm" onClick={() => toast.info("Незабаром!", "Stars платежі в розробці")}
                        className="h-7 text-xs px-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold">
                        Купити
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Battle Pass teaser */}
          <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 border border-orange-500/20 rounded-2xl p-4 flex items-center gap-3">
            <Flame className="w-8 h-8 text-orange-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-white text-sm">Battle Pass — скоро</p>
              <p className="text-xs text-slate-500">50 рівнів · Legacy гарантований · Ексклюзиви</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0d0d16]/95 backdrop-blur-sm border-t border-[#1e1e2e] px-6 py-3">
        <div className="flex justify-around">
          {[{ icon: Package, label: "Паки", action: () => navigate("/pack-open") },
            { icon: Backpack, label: "Інвентар", action: () => navigate("/inventory") },
            { icon: Store, label: "Маркет", action: () => navigate("/market") },
            { icon: Trophy, label: "Топ", action: () => toast.info("Скоро!", "Leaderboard в розробці") },
          ].map(({ icon: Icon, label, action }) => (
            <button key={label} onClick={action} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors">
              <Icon className="w-5 h-5" /><span className="text-[10px]">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
