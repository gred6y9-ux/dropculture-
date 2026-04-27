import { useState } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, Zap, Star, Clock } from "lucide-react";
import { SpinWheel } from "@/components/SpinWheel";
import { toast } from "@/components/Toast";

export default function WheelPage() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const { data: wheelStatus, refetch: refetchWheel } = trpc.wheel.status.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const spinMutation = trpc.wheel.spin.useMutation({
    onSuccess: (data) => {
      setLastResult(data.rewardDescription);
      setShowResult(true);
      refetchWheel();
      refetchProfile();
    },
    onError: (err) => {
      setIsSpinning(false);
      toast.error("Помилка", err.message);
    },
  });

  const handleSpin = () => {
    if (!wheelStatus?.canSpin || isSpinning) return;
    setIsSpinning(true);
    setShowResult(false);
    setLastResult(null);
    // Mutation called after animation ends (4-5 sec)
    // We start it immediately for faster API response
    spinMutation.mutate();
  };

  const handleSpinEnd = () => {
    setIsSpinning(false);
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <p className="text-slate-400">Потрібна авторизація</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-8">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-base">Колесо фортуни</h1>
          <p className="text-xs text-slate-500">Раз на 12 годин</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-[#1a1a28] rounded-xl px-3 py-1.5">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-yellow-400 font-bold text-sm">{(profile?.user?.coins ?? 0).toLocaleString()}</span>
        </div>
      </div>

      <div className="px-4 flex flex-col items-center">

        {/* Status */}
        {!wheelStatus?.canSpin && (
          <Card className="w-full bg-[#1a1a28] border-[#2a2a3e] rounded-2xl p-3 mb-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div>
              <p className="text-white font-bold text-sm">Наступне кручення</p>
              <p className="text-slate-400 text-xs">через {wheelStatus?.hoursRemaining ?? "..."} годин</p>
            </div>
          </Card>
        )}

        {/* Result banner */}
        {showResult && lastResult && (
          <div className="w-full bg-gradient-to-r from-green-900/50 to-emerald-900/50 border border-green-500/30 rounded-2xl p-4 mb-4 text-center animate-bounce">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-green-400 font-bold text-lg">{lastResult}</p>
          </div>
        )}

        {/* Wheel */}
        <div className="my-6">
          <SpinWheel
            isSpinning={isSpinning}
            onSpinEnd={handleSpinEnd}
            disabled={!wheelStatus?.canSpin}
          />
        </div>

        {/* Spin button */}
        <Button
          onClick={handleSpin}
          disabled={!wheelStatus?.canSpin || isSpinning}
          className={`w-full max-w-xs h-14 text-base font-bold rounded-2xl shadow-lg transition-all ${
            wheelStatus?.canSpin && !isSpinning
              ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 shadow-purple-500/20"
              : "bg-[#1a1a28] text-slate-500 cursor-not-allowed"
          }`}
        >
          {isSpinning ? "🎡 Крутиться..." : wheelStatus?.canSpin ? "🎡 Крутити!" : `⏱ Через ${wheelStatus?.hoursRemaining ?? "..."} год`}
        </Button>

        {/* Prizes table */}
        <div className="w-full mt-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Можливі призи</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { emoji: "💰", label: "50 монет",    chance: "35%",  color: "text-slate-300" },
              { emoji: "💰", label: "100 монет",   chance: "25%",  color: "text-blue-300"  },
              { emoji: "💰", label: "250 монет",   chance: "15%",  color: "text-purple-300"},
              { emoji: "💰", label: "500 монет",   chance: "10%",  color: "text-pink-300"  },
              { emoji: "⚫", label: "Stock предмет",chance: "8%",   color: "text-slate-400" },
              { emoji: "🔵", label: "Refined",     chance: "5%",   color: "text-blue-400"  },
              { emoji: "💎", label: "1000 монет",  chance: "1.5%", color: "text-amber-400" },
              { emoji: "🟣", label: "Rare предмет",chance: "0.5%", color: "text-purple-400"},
            ].map((p, i) => (
              <Card key={i} className="bg-[#12121a] border-[#1e1e2e] rounded-xl p-2.5 flex items-center gap-2">
                <span className="text-lg">{p.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${p.color} truncate`}>{p.label}</p>
                </div>
                <span className="text-[10px] text-slate-500 flex-shrink-0">{p.chance}</span>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
