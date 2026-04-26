import { useState, useEffect, useCallback } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { Package, ArrowLeft, Sparkles } from "lucide-react";

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  Stock: { bg: "from-gray-700 to-gray-800", text: "text-gray-300", border: "border-gray-600", glow: "shadow-gray-500/20" },
  Refined: { bg: "from-blue-700 to-blue-900", text: "text-blue-300", border: "border-blue-500", glow: "shadow-blue-500/30" },
  Rare: { bg: "from-purple-700 to-purple-900", text: "text-purple-300", border: "border-purple-500", glow: "shadow-purple-500/30" },
  Exotic: { bg: "from-pink-700 to-pink-900", text: "text-pink-300", border: "border-pink-500", glow: "shadow-pink-500/30" },
  Legacy: { bg: "from-amber-600 to-amber-800", text: "text-amber-300", border: "border-amber-500", glow: "shadow-amber-500/40" },
};

const GRADE_LABELS: Record<string, string> = {
  Stock: "Stock",
  Refined: "Refined",
  Rare: "Rare",
  Exotic: "Exotic",
  Legacy: "LEGACY",
};

export default function PackOpen() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"idle" | "shaking" | "opening" | "revealing" | "done">("idle");
  const [items, setItems] = useState<any[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([false, false, false, false, false]);
  const [currentReveal, setCurrentReveal] = useState(-1);

  const openPackMutation = trpc.game.openPack.useMutation({
    onSuccess: (data) => {
      setItems(data.items);
      setPhase("revealing");
      setCurrentReveal(0);
    },
  });

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && phase === "opening") {
      tg.HapticFeedback.impactOccurred("medium");
    }
  }, [phase]);

  const handleOpen = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("shaking");
    setTimeout(() => {
      setPhase("opening");
      openPackMutation.mutate({ packType: "daily" });
    }, 800);
  }, [phase, openPackMutation]);

  const revealNext = useCallback(() => {
    if (currentReveal >= 4) {
      setRevealed([true, true, true, true, true]);
      setPhase("done");
      const tg = (window as any).Telegram?.WebApp;
      if (tg) tg.HapticFeedback.notificationOccurred("success");
      return;
    }
    const newRevealed = [...revealed];
    newRevealed[currentReveal] = true;
    setRevealed(newRevealed);
    setCurrentReveal(currentReveal + 1);
    const tg = (window as any).Telegram?.WebApp;
    if (tg) tg.HapticFeedback.impactOccurred("light");
  }, [currentReveal, revealed]);

  useEffect(() => {
    if (phase === "revealing" && currentReveal >= 0 && currentReveal < 5) {
      const timer = setTimeout(() => {
        revealNext();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [phase, currentReveal, revealNext]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-slate-400">Потрібна авторизація</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden">
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {phase === "opening" && Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-purple-400 rounded-full animate-ping"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-semibold text-lg">Відкриття паку</h1>
      </div>

      <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: "70vh" }}>
        {phase === "idle" && (
          <div className="text-center">
            <div
              className="relative w-48 h-64 mx-auto mb-8 cursor-pointer"
              onClick={handleOpen}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-purple-700 to-blue-800 rounded-2xl shadow-2xl shadow-purple-500/30 flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEwIDBMMjAgMTBMMTAgMjBMMCAxMHoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-30" />
                <Package className="w-20 h-20 text-white/80" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
                5
              </div>
            </div>
            <p className="text-slate-400 mb-4">Натисніть на пак, щоб відкрити</p>
            <Button
              onClick={handleOpen}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold px-8 py-6 rounded-xl"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Відкрити пак
            </Button>
          </div>
        )}

        {phase === "shaking" && (
          <div className="text-center">
            <div className="w-48 h-64 mx-auto mb-8 animate-bounce">
              <div className="w-full h-full bg-gradient-to-br from-purple-600 via-purple-700 to-blue-800 rounded-2xl shadow-2xl shadow-purple-500/40 flex items-center justify-center animate-pulse">
                <Package className="w-20 h-20 text-white animate-spin" style={{ animationDuration: "0.5s" }} />
              </div>
            </div>
            <p className="text-purple-400 animate-pulse">Розкриваємо...</p>
          </div>
        )}

        {phase === "opening" && (
          <div className="text-center">
            <div className="w-48 h-64 mx-auto mb-8 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-800 rounded-2xl animate-ping opacity-30" />
              <div className="w-full h-full bg-gradient-to-br from-purple-500 via-pink-500 to-blue-600 rounded-2xl shadow-2xl flex items-center justify-center animate-pulse">
                <Sparkles className="w-24 h-24 text-white animate-spin" style={{ animationDuration: "2s" }} />
              </div>
            </div>
            <p className="text-pink-400 animate-pulse">Генерація предметів...</p>
          </div>
        )}

        {(phase === "revealing" || phase === "done") && items.length > 0 && (
          <div className="w-full max-w-md">
            <div className="grid grid-cols-5 gap-2 mb-6">
              {items.map((item, i) => {
                const grade = item.template?.grade || "Stock";
                const colors = GRADE_COLORS[grade] || GRADE_COLORS.Stock;
                const isRevealed = revealed[i];
                const isCurrent = currentReveal === i && phase === "revealing";

                return (
                  <div
                    key={item.id}
                    className={`relative aspect-[2/3] rounded-lg border-2 cursor-pointer transition-all duration-500 ${
                      isRevealed
                        ? `bg-gradient-to-br ${colors.bg} ${colors.border} ${colors.glow} shadow-lg`
                        : "bg-[#1a1a2e] border-[#2a2a3e]"
                    } ${isCurrent ? "scale-110 ring-2 ring-purple-500 z-10" : ""}`}
                    style={{
                      transform: isRevealed ? "rotateY(0deg)" : "rotateY(180deg)",
                      transformStyle: "preserve-3d",
                    }}
                    onClick={() => {
                      if (phase === "done" && !isRevealed) {
                        const newRevealed = [...revealed];
                        newRevealed[i] = true;
                        setRevealed(newRevealed);
                      }
                    }}
                  >
                    {!isRevealed ? (
                      <div className="absolute inset-0 flex items-center justify-center backface-hidden">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold">
                          ?
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-1 backface-hidden">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-1">
                          <Sparkles className={`w-4 h-4 ${colors.text}`} />
                        </div>
                        <p className="text-[8px] font-bold text-center leading-tight text-white truncate w-full">
                          {item.template?.name}
                        </p>
                        <p className={`text-[6px] font-semibold ${colors.text}`}>
                          {GRADE_LABELS[grade]}
                        </p>
                        <p className="text-[6px] text-white/60 mt-0.5">
                          #{item.serialNum}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {phase === "done" && (
              <div className="text-center space-y-3">
                <p className="text-lg font-bold text-white">Випали предмети!</p>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => navigate("/inventory")}
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  >
                    Інвентар
                  </Button>
                  <Button
                    onClick={() => {
                      setPhase("idle");
                      setItems([]);
                      setRevealed([false, false, false, false, false]);
                      setCurrentReveal(-1);
                    }}
                    className="bg-gradient-to-r from-purple-500 to-blue-500"
                  >
                    Ще пак
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
