import { useState, useEffect, useCallback } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router";
import { Package, ArrowLeft, Sparkles, Zap, Star } from "lucide-react";

const GRADE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string; emoji: string }> = {
  Stock:   { bg: "from-slate-700 to-slate-800", border: "border-slate-500", text: "text-slate-300", glow: "shadow-slate-500/20", emoji: "⚫" },
  Refined: { bg: "from-blue-700 to-blue-900",   border: "border-blue-500",  text: "text-blue-300",  glow: "shadow-blue-500/30",  emoji: "🔵" },
  Rare:    { bg: "from-purple-700 to-purple-900", border: "border-purple-500", text: "text-purple-300", glow: "shadow-purple-500/30", emoji: "🟣" },
  Exotic:  { bg: "from-pink-700 to-pink-900",   border: "border-pink-500",  text: "text-pink-300",  glow: "shadow-pink-500/40",  emoji: "🌸" },
  Legacy:  { bg: "from-amber-600 to-amber-800", border: "border-amber-400", text: "text-amber-300", glow: "shadow-amber-500/50", emoji: "👑" },
};

const PACK_INFO: Record<string, { emoji: string; color: string; label: string }> = {
  daily:    { emoji: "🎁", color: "from-blue-600 to-blue-800", label: "Щоденний пак" },
  starter:  { emoji: "🌑", color: "from-slate-600 to-slate-800", label: "Starter Pack" },
  standard: { emoji: "💎", color: "from-purple-600 to-blue-800", label: "Standard Pack" },
  premium:  { emoji: "✨", color: "from-pink-600 to-purple-800", label: "Premium Pack" },
  vip:      { emoji: "⭐", color: "from-purple-600 to-pink-800", label: "VIP Pack" },
  legendary:{ emoji: "🔥", color: "from-orange-600 to-red-800",  label: "Legendary Pack" },
  mythic:   { emoji: "👑", color: "from-amber-500 to-yellow-700", label: "Mythic Drop" },
};

export default function PackOpen() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const packType = (searchParams.get("type") ?? "standard") as any;
  const packInfo = PACK_INFO[packType] ?? PACK_INFO.standard;

  const [phase, setPhase] = useState<"idle" | "shaking" | "opening" | "revealing" | "done">("idle");
  const [items, setItems] = useState<any[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [currentReveal, setCurrentReveal] = useState(-1);
  const [hasLegacy, setHasLegacy] = useState(false);

  const openPackMutation = trpc.game.openPack.useMutation({
    onSuccess: (data) => {
      const newItems = data.items.filter(Boolean);
      setItems(newItems);
      setRevealed(new Array(newItems.length).fill(false));
      setHasLegacy(newItems.some((i: any) => i?.template?.grade === "Legacy"));
      setPhase("revealing");
      setCurrentReveal(0);
    },
    onError: (err) => {
      alert(err.message);
      setPhase("idle");
    },
  });

  const getDailyMutation = trpc.game.getDailyPack.useMutation({
    onSuccess: () => { navigate("/"); },
  });

  const handleOpen = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("shaking");
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");
    setTimeout(() => {
      setPhase("opening");
      if (packType === "daily") {
        getDailyMutation.mutate();
      } else {
        openPackMutation.mutate({ packType });
      }
    }, 1000);
  }, [phase, packType]);

  const revealNext = useCallback(() => {
    if (currentReveal >= items.length) {
      setRevealed(prev => prev.map(() => true));
      setPhase("done");
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        if (hasLegacy) {
          tg.HapticFeedback.notificationOccurred("success");
        } else {
          tg.HapticFeedback.impactOccurred("light");
        }
      }
      return;
    }
    setRevealed(prev => { const n = [...prev]; n[currentReveal] = true; return n; });
    setCurrentReveal(c => c + 1);
    const tg = (window as any).Telegram?.WebApp;
    const item = items[currentReveal];
    const grade = item?.template?.grade;
    if (tg?.HapticFeedback) {
      if (grade === "Legacy" || grade === "Exotic") tg.HapticFeedback.notificationOccurred("success");
      else tg.HapticFeedback.impactOccurred("light");
    }
  }, [currentReveal, items, hasLegacy]);

  useEffect(() => {
    if (phase === "revealing" && currentReveal >= 0 && currentReveal <= items.length) {
      const delay = currentReveal === 0 ? 400 : 600;
      const t = setTimeout(revealNext, delay);
      return () => clearTimeout(t);
    }
  }, [phase, currentReveal]);

  const reset = () => {
    setPhase("idle"); setItems([]); setRevealed([]);
    setCurrentReveal(-1); setHasLegacy(false);
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <p className="text-slate-400">Потрібна авторизація</p>
    </div>
  );

  return (
    <div className={`min-h-screen text-white relative overflow-hidden transition-colors duration-1000 ${
      hasLegacy && phase === "done" ? "bg-[#1a1000]" : "bg-[#0a0a0f]"
    }`}>
      {/* Legacy glow */}
      {hasLegacy && phase === "done" && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-radial from-amber-500/10 to-transparent animate-pulse" />
        </div>
      )}

      {/* Particles */}
      {phase === "opening" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="absolute w-1 h-1 bg-purple-400 rounded-full animate-ping"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`, animationDuration: `${0.8 + Math.random() * 1.5}s` }} />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-5 pb-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xl">{packInfo.emoji}</span>
          <h1 className="font-bold text-base">{packInfo.label}</h1>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: "80vh" }}>

        {/* IDLE */}
        {phase === "idle" && (
          <div className="text-center w-full max-w-xs">
            <div onClick={handleOpen} className="relative w-48 h-64 mx-auto mb-8 cursor-pointer group">
              <div className={`absolute inset-0 bg-gradient-to-br ${packInfo.color} rounded-3xl shadow-2xl flex items-center justify-center transform group-hover:scale-105 group-active:scale-95 transition-all duration-200 overflow-hidden`}>
                <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,white_0px,white_1px,transparent_1px,transparent_8px)]" />
                <span className="text-6xl filter drop-shadow-lg">{packInfo.emoji}</span>
              </div>
              <div className="absolute -top-3 -right-3 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-sm font-bold shadow-lg animate-bounce">
                {packType === "mythic" ? "1" : "5"}
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-6">Натисни на пак або кнопку нижче</p>
            <Button onClick={handleOpen} className={`w-full h-14 text-base font-bold bg-gradient-to-r ${packInfo.color} hover:opacity-90 rounded-2xl shadow-lg`}>
              <Sparkles className="w-5 h-5 mr-2" /> Відкрити!
            </Button>
          </div>
        )}

        {/* SHAKING */}
        {phase === "shaking" && (
          <div className="text-center">
            <div className="relative w-48 h-64 mx-auto mb-8 animate-bounce">
              <div className={`w-full h-full bg-gradient-to-br ${packInfo.color} rounded-3xl shadow-2xl flex items-center justify-center`}>
                <span className="text-6xl animate-spin" style={{ animationDuration: "0.4s" }}>{packInfo.emoji}</span>
              </div>
            </div>
            <p className="text-purple-400 animate-pulse font-semibold">Розкриваємо...</p>
          </div>
        )}

        {/* OPENING */}
        {phase === "opening" && (
          <div className="text-center">
            <div className="relative w-48 h-64 mx-auto mb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl animate-ping opacity-30" />
              <div className={`w-full h-full bg-gradient-to-br ${packInfo.color} rounded-3xl shadow-2xl flex items-center justify-center animate-pulse`}>
                <Sparkles className="w-20 h-20 text-white animate-spin" style={{ animationDuration: "1.5s" }} />
              </div>
            </div>
            <p className="text-pink-400 animate-pulse font-semibold">Генерація предметів...</p>
          </div>
        )}

        {/* REVEALING / DONE */}
        {(phase === "revealing" || phase === "done") && items.length > 0 && (
          <div className="w-full max-w-sm">
            {hasLegacy && phase === "done" && (
              <div className="text-center mb-4 animate-bounce">
                <p className="text-amber-400 font-bold text-lg">👑 LEGACY DROP! 👑</p>
              </div>
            )}

            <div className={`grid gap-2 mb-6 ${items.length <= 3 ? "grid-cols-3" : "grid-cols-5"}`}>
              {items.map((item, i) => {
                if (!item) return null;
                const grade = item.template?.grade ?? "Stock";
                const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.Stock;
                const isRevealed = revealed[i];
                const isCurrent = currentReveal === i && phase === "revealing";

                return (
                  <div key={item.id ?? i}
                    className={`relative aspect-[2/3] rounded-xl border-2 transition-all duration-500 overflow-hidden
                      ${isRevealed
                        ? `bg-gradient-to-br ${colors.bg} ${colors.border} shadow-lg ${colors.glow}`
                        : "bg-[#1a1a2e] border-[#2a2a3e]"}
                      ${isCurrent ? "scale-110 ring-2 ring-white/50 z-10" : ""}
                      ${grade === "Legacy" && isRevealed ? "ring-2 ring-amber-400 scale-105" : ""}
                    `}>
                    {!isRevealed ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold">?</div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-1 gap-0.5">
                        <span className="text-xl">{colors.emoji}</span>
                        <p className="text-[7px] font-bold text-center text-white leading-tight px-0.5 truncate w-full text-center">
                          {item.template?.name ?? "?"}
                        </p>
                        <p className={`text-[6px] font-bold ${colors.text}`}>{grade}</p>
                        <p className="text-[5px] text-white/50">#{item.serialNum}</p>
                        <p className="text-[5px] text-yellow-400">
                          {(item.marketPrice ?? 0).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {phase === "done" && (
              <div className="space-y-3">
                <div className="bg-[#12121a] rounded-2xl p-3 text-center">
                  <p className="text-white font-bold mb-1 text-sm">Загальна вартість</p>
                  <p className="text-yellow-400 font-bold text-xl flex items-center justify-center gap-1">
                    <Zap className="w-4 h-4" />
                    {items.reduce((s, i) => s + (i?.marketPrice ?? 0), 0).toLocaleString()}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => navigate("/inventory")}
                    className="border-[#2a2a3e] text-slate-300 hover:bg-[#1a1a2e] rounded-xl">
                    Інвентар
                  </Button>
                  <Button onClick={reset}
                    className={`bg-gradient-to-r ${packInfo.color} hover:opacity-90 rounded-xl font-bold`}>
                    Ще раз!
                  </Button>
                </div>
                <Button variant="ghost" onClick={() => navigate("/")}
                  className="w-full text-slate-400 hover:text-white text-sm">
                  ← На головну
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
