import { useTelegramAuth } from "@/providers/telegram-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router";
import {
  Package, Backpack, Store, Sparkles, TrendingUp,
  Zap, RotateCcw, Star, Trophy, Gift, Flame
} from "lucide-react";
import { useEffect, useState } from "react";

const GRADE_COLORS: Record<string, string> = {
  Stock: "bg-slate-500", Refined: "bg-blue-500", Rare: "bg-purple-500",
  Exotic: "bg-pink-500", Legacy: "bg-amber-500",
};
const GRADE_TEXT: Record<string, string> = {
  Stock: "text-slate-400", Refined: "text-blue-400", Rare: "text-purple-400",
  Exotic: "text-pink-400", Legacy: "text-amber-400",
};

export default function Home() {
  const { user, isLoading, isAuthenticated, login } = useTelegramAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"home" | "shop">("home");
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const { data: dailyStatus, refetch: refetchDaily } = trpc.game.checkDailyStatus.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const { data: wheelStatus, refetch: refetchWheel } = trpc.wheel.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const { data: packConfigs } = trpc.game.getPackConfigs.useQuery(undefined, { enabled: isAuthenticated, retry: false });

  const claimDaily = trpc.game.getDailyPack.useMutation({
    onSuccess: () => { refetchDaily(); refetchProfile(); },
  });

  const spinWheel = trpc.wheel.spin.useMutation({
    onSuccess: (data) => {
      setSpinResult("🎉 " + data.rewardDescription);
      refetchWheel(); refetchProfile();
      setTimeout(() => { setSpinResult(null); setIsSpinning(false); }, 3000);
    },
    onError: (err) => {
      setSpinResult(err.message);
      setTimeout(() => { setSpinResult(null); setIsSpinning(false); }, 3000);
    },
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
  const coinPacks = packConfigs?.filter(p => p.currency === "coins" && p.id !== "daily") ?? [];
  const starPacks = packConfigs?.filter(p => p.currency === "stars") ?? [];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-lg font-bold">
              {displayUser?.firstName?.[0] ?? displayUser?.username?.[0] ?? "?"}
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{displayUser?.firstName ?? displayUser?.username ?? "Гравець"}</p>
              <p className="text-xs text-slate-500">@{displayUser?.username ?? "..."}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="bg-[#1a1a28] rounded-xl px-3 py-1.5 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-yellow-400 font-bold text-sm">{displayUser?.coins ?? 0}</span>
            </div>
            <div className="bg-[#1a1a28] rounded-xl px-3 py-1.5 flex items-center gap-1.5">
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
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === tab ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
            {tab === "home" ? "🏠 Головна" : "🛒 Магазин"}
          </button>
        ))}
      </div>

      {activeTab === "home" && (
        <div className="px-4 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="bg-[#12121a] border-[#1e1e2e] p-3 text-center">
              <p className="text-xl font-bold text-white">{stats?.totalItems ?? 0}</p>
              <p className="text-xs text-slate-500">Предметів</p>
            </Card>
            <Card className="bg-[#12121a] border-[#1e1e2e] p-3 text-center">
              <p className="text-xl font-bold text-yellow-400">{(stats?.totalValue ?? 0).toLocaleString()}</p>
              <p className="text-xs text-slate-500">Вартість</p>
            </Card>
            <Card className="bg-[#12121a] border-[#1e1e2e] p-3 text-center">
              <p className="text-xl font-bold text-amber-400">{stats?.legacyCount ?? 0}</p>
              <p className="text-xs text-slate-500">Legacy</p>
            </Card>
          </div>

          {/* Wheel */}
          <Card className="bg-gradient-to-br from-[#1a1228] to-[#12121a] border-purple-500/20 p-4">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/20 flex-shrink-0 ${isSpinning ? "animate-spin" : ""}`}>🎡</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm mb-0.5">Колесо фортуни</p>
                {spinResult ? (
                  <p className="text-green-400 text-sm font-semibold truncate">{spinResult}</p>
                ) : (
                  <p className="text-xs text-slate-400">50–1000 монет · Предмети · Раз на 12 год</p>
                )}
              </div>
              <Button onClick={() => { if (!wheelStatus?.canSpin || isSpinning) return; setIsSpinning(true); spinWheel.mutate(); }}
                disabled={!wheelStatus?.canSpin || isSpinning} size="sm"
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 rounded-xl flex-shrink-0 text-xs">
                {wheelStatus?.canSpin ? "Крути!" : `${wheelStatus?.hoursRemaining}г`}
              </Button>
            </div>
          </Card>

          {/* Daily */}
          <Card className="bg-gradient-to-br from-[#1a2028] to-[#12121a] border-blue-500/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Gift className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Щоденний пак</p>
                  <p className="text-xs text-slate-400">{dailyStatus?.canClaim ? "Готовий!" : `Через ${dailyStatus?.hoursRemaining ?? 0} год`}</p>
                  <div className="flex gap-0.5 mt-1">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className={`w-3 h-1 rounded-full ${i < (dailyStatus?.streak ?? 0) ? "bg-purple-500" : "bg-[#1e1e2e]"}`} />
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={() => claimDaily.mutate()} disabled={!dailyStatus?.canClaim || claimDaily.isPending} size="sm"
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl">Забрати</Button>
            </div>
          </Card>

          {/* Open Pack */}
          <Button onClick={() => navigate("/pack-open")}
            className="w-full h-14 text-base font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:opacity-90 rounded-2xl shadow-lg shadow-purple-500/20">
            <Package className="w-5 h-5 mr-2" /> Відкрити пак
          </Button>

          {/* Nav */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => navigate("/inventory")}
              className="h-16 bg-[#12121a] border-[#1e1e2e] hover:bg-[#1a1a28] hover:border-purple-500/30 flex flex-col items-center gap-1.5 rounded-2xl">
              <Backpack className="w-5 h-5 text-purple-400" />
              <span className="text-xs">Інвентар</span>
            </Button>
            <Button variant="outline" onClick={() => navigate("/market")}
              className="h-16 bg-[#12121a] border-[#1e1e2e] hover:bg-[#1a1a28] hover:border-blue-500/30 flex flex-col items-center gap-1.5 rounded-2xl">
              <Store className="w-5 h-5 text-blue-400" />
              <span className="text-xs">Маркет</span>
            </Button>
          </div>

          {/* Trending */}
          <div>
            <h3 className="font-bold text-white mb-2 flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-green-400" /> Trending
            </h3>
            {[{ name: "Eternal Flame", grade: "Legacy", price: 12500, change: "+12%" },
              { name: "Abyss Eye", grade: "Legacy", price: 18700, change: "+8%" },
              { name: "Plasma Cage", grade: "Exotic", price: 3400, change: "+5%" }].map((item, i) => (
              <Card key={i} className="bg-[#12121a] border-[#1e1e2e] p-3 flex items-center justify-between mb-2">
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

      {activeTab === "shop" && (
        <div className="px-4 space-y-4">
          <div>
            <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-yellow-400" /> Паки за монети
            </h3>
            {coinPacks.map(pack => {
              const emoji = pack.id === "starter" ? "🌑" : pack.id === "standard" ? "💎" : "✨";
              const rareChance = Math.round(((pack.grades as any).Rare ?? 0) * 100);
              const exoticChance = Math.round(((pack.grades as any).Exotic ?? 0) * 100);
              const legacyChance = Math.round(((pack.grades as any).Legacy ?? 0) * 100);
              const canAfford = (displayUser?.coins ?? 0) >= pack.cost;
              return (
                <Card key={pack.id} className="bg-[#12121a] border-[#1e1e2e] p-4 mb-2">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{emoji}</span>
                      <div>
                        <p className="font-bold text-white text-sm">{pack.name}</p>
                        <p className="text-xs text-slate-500">{pack.items} предметів</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-400 font-bold text-sm">
                      <Zap className="w-3.5 h-3.5" />{pack.cost.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {rareChance > 0 && <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-lg">Rare {rareChance}%</span>}
                    {exoticChance > 0 && <span className="bg-pink-500/20 text-pink-400 text-xs px-2 py-0.5 rounded-lg">Exotic {exoticChance}%</span>}
                    {legacyChance > 0 && <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-lg">Legacy {legacyChance}%</span>}
                  </div>
                  <Button onClick={() => navigate(`/pack-open?type=${pack.id}`)} disabled={!canAfford}
                    className={`w-full rounded-xl text-sm font-bold ${canAfford ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90" : "bg-[#1e1e2e] text-slate-500"}`}>
                    {canAfford ? "Відкрити" : "Недостатньо монет"}
                  </Button>
                </Card>
              );
            })}
          </div>

          <div>
            <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-purple-400" /> VIP за Stars
            </h3>
            {starPacks.map(pack => {
              const emoji = pack.id === "vip" ? "⭐" : pack.id === "legendary" ? "🔥" : "👑";
              const exoticChance = Math.round(((pack.grades as any).Exotic ?? 0) * 100);
              const legacyChance = Math.round(((pack.grades as any).Legacy ?? 0) * 100);
              return (
                <Card key={pack.id} className="bg-gradient-to-br from-purple-900/20 to-[#12121a] border-purple-500/20 p-4 mb-2">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{emoji}</span>
                      <div>
                        <p className="font-bold text-white text-sm">{pack.name}</p>
                        <p className="text-xs text-slate-500">{pack.items} предметів</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-purple-400 font-bold text-sm">
                      <Star className="w-3.5 h-3.5" />{pack.cost}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {exoticChance > 0 && <span className="bg-pink-500/20 text-pink-400 text-xs px-2 py-0.5 rounded-lg">Exotic {exoticChance}%</span>}
                    {legacyChance > 0 && <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-lg">Legacy {legacyChance}%</span>}
                  </div>
                  <Button onClick={() => alert("Незабаром! Stars платежі в розробці.")}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 rounded-xl text-sm font-bold">
                    ⭐ Купити за {pack.cost} Stars
                  </Button>
                </Card>
              );
            })}
          </div>

          <Card className="bg-[#12121a] border-dashed border-[#1e1e2e] p-4 text-center">
            <Flame className="w-8 h-8 text-orange-400 mx-auto mb-2" />
            <p className="text-white font-bold text-sm mb-1">Battle Pass — Скоро</p>
            <p className="text-xs text-slate-500">50 рівнів · Legacy гарантований</p>
          </Card>
        </div>
      )}

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0d0d16] border-t border-[#1e1e2e] px-4 py-3">
        <div className="flex justify-around">
          {[{ icon: Package, label: "Паки", action: () => navigate("/pack-open") },
            { icon: Backpack, label: "Інвентар", action: () => navigate("/inventory") },
            { icon: Store, label: "Маркет", action: () => navigate("/market") },
            { icon: Trophy, label: "Топ", action: () => {} },
          ].map(({ icon: Icon, label, action }) => (
            <button key={label} onClick={action} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors">
              <Icon className="w-5 h-5" /><span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
