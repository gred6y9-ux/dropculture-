import { useTelegramAuth } from "@/providers/telegram-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router";
import { Package, Backpack, Store, Sparkles, TrendingUp, Zap } from "lucide-react";
import { useEffect } from "react";

export default function Home() {
  const { user, isLoading, isAuthenticated, login } = useTelegramAuth();
  const navigate = useNavigate();

  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: dailyStatus, refetch: refetchDaily } = trpc.game.checkDailyStatus.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const claimDaily = trpc.game.getDailyPack.useMutation({
    onSuccess: () => {
      refetchDaily();
      refetchProfile();
    },
  });

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Завантаження...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">DropCulture</h1>
          <p className="text-slate-400 mb-8">Симулятор цифрового трейдера. Відкривай паки, колекціонуй рідкісні предмети, торгуй на маркеті.</p>
          <Button
            onClick={login}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold py-6 rounded-xl"
          >
            Увійти через Telegram
          </Button>
        </div>
      </div>
    );
  }

  const displayUser = profile?.user ?? user;
  const stats = profile?.stats;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-20">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {displayUser?.avatar ? (
              <img src={displayUser.avatar} alt="avatar" className="w-12 h-12 rounded-full border-2 border-purple-500/50" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-lg font-bold">
                {displayUser?.firstName?.[0] ?? displayUser?.username?.[0] ?? "?"}
              </div>
            )}
            <div>
              <h2 className="font-semibold text-white">{displayUser?.firstName ?? displayUser?.username ?? "Гравець"}</h2>
              <p className="text-xs text-slate-400">@{displayUser?.username ?? "..."}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-yellow-400">
              <Zap className="w-4 h-4" />
              <span className="font-bold">{displayUser?.coins ?? 0}</span>
            </div>
            <div className="flex items-center gap-1 text-purple-400 text-xs">
              <Sparkles className="w-3 h-3" />
              <span>{displayUser?.stars ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-[#12121a] border-[#1e1e2e] p-3 text-center">
            <p className="text-2xl font-bold text-white">{stats?.totalItems ?? 0}</p>
            <p className="text-xs text-slate-400">Предметів</p>
          </Card>
          <Card className="bg-[#12121a] border-[#1e1e2e] p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats?.totalValue ?? 0}</p>
            <p className="text-xs text-slate-400">Вартість</p>
          </Card>
          <Card className="bg-[#12121a] border-[#1e1e2e] p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{stats?.legacyCount ?? 0}</p>
            <p className="text-xs text-slate-400">Legacy</p>
          </Card>
        </div>

        {/* Daily Pack */}
        <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/20 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white mb-1">Щоденний пак</h3>
              <p className="text-sm text-slate-400">
                {dailyStatus?.canClaim
                  ? "Готовий до відкриття!"
                  : dailyStatus?.hoursRemaining
                    ? `Через ${dailyStatus.hoursRemaining} год`
                    : "Вже відкрито сьогодні"}
              </p>
              {dailyStatus?.streak ? (
                <p className="text-xs text-purple-400 mt-1">Streak: {dailyStatus.streak} днів</p>
              ) : null}
            </div>
            <Button
              onClick={() => claimDaily.mutate()}
              disabled={!dailyStatus?.canClaim || claimDaily.isPending}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-50"
            >
              <Package className="w-4 h-4 mr-2" />
              Забрати
            </Button>
          </div>
        </Card>

        {/* Main Action */}
        <Button
          onClick={() => navigate("/pack-open")}
          className="w-full h-16 text-lg font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:from-pink-600 hover:via-purple-600 hover:to-blue-600 rounded-xl mb-6 shadow-lg shadow-purple-500/20"
        >
          <Package className="w-6 h-6 mr-3" />
          Відкрити пак
        </Button>

        {/* Navigation Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/inventory")}
            className="h-20 bg-[#12121a] border-[#1e1e2e] hover:bg-[#1a1a28] hover:border-purple-500/30 flex flex-col items-center gap-2"
          >
            <Backpack className="w-6 h-6 text-purple-400" />
            <span className="text-sm">Інвентар</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/market")}
            className="h-20 bg-[#12121a] border-[#1e1e2e] hover:bg-[#1a1a28] hover:border-purple-500/30 flex flex-col items-center gap-2"
          >
            <Store className="w-6 h-6 text-blue-400" />
            <span className="text-sm">Маркет</span>
          </Button>
        </div>

        {/* Trending */}
        <div className="mt-6">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            Trending
          </h3>
          <div className="space-y-2">
            {[
              { name: "Eternal Flame", grade: "Legacy", price: 12500, change: "+12%" },
              { name: "Abyss Eye", grade: "Legacy", price: 18700, change: "+8%" },
              { name: "Plasma Cage", grade: "Exotic", price: 3400, change: "+5%" },
            ].map((item, i) => (
              <Card key={i} className="bg-[#12121a] border-[#1e1e2e] p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-8 rounded-full ${
                    item.grade === "Legacy" ? "bg-amber-500" :
                    item.grade === "Exotic" ? "bg-pink-500" :
                    item.grade === "Rare" ? "bg-purple-500" :
                    item.grade === "Refined" ? "bg-blue-500" : "bg-gray-500"
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-white">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.grade}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{item.price.toLocaleString()}</p>
                  <p className="text-xs text-green-400">{item.change}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
