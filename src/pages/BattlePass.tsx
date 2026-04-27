import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, Lock, Star, Zap, Crown, ChevronRight, Flame } from "lucide-react";

// Test data - 50 levels
const CURRENT_LEVEL = 7;
const CURRENT_XP = 340;
const XP_PER_LEVEL = 100;

type Reward = { type: "coins" | "item" | "pack" | "badge"; value: string; grade?: string };

function getReward(level: number): { free: Reward; premium: Reward } {
  const freeRewards: Record<number, Reward> = {
    1:  { type: "coins", value: "50" },
    5:  { type: "item",  value: "Stock сфера", grade: "Stock" },
    10: { type: "pack",  value: "Starter Pack" },
    15: { type: "coins", value: "200" },
    20: { type: "item",  value: "Refined сфера", grade: "Refined" },
    25: { type: "pack",  value: "Standard Pack" },
    30: { type: "coins", value: "500" },
    35: { type: "item",  value: "Rare сфера", grade: "Rare" },
    40: { type: "pack",  value: "Premium Pack" },
    45: { type: "coins", value: "1000" },
    50: { type: "item",  value: "Exotic сфера", grade: "Exotic" },
  };
  const premiumRewards: Record<number, Reward> = {
    1:  { type: "coins", value: "100" },
    3:  { type: "item",  value: "Stock сфера", grade: "Stock" },
    5:  { type: "pack",  value: "Standard Pack" },
    7:  { type: "coins", value: "150" },
    10: { type: "item",  value: "Refined сфера", grade: "Refined" },
    12: { type: "coins", value: "250" },
    15: { type: "pack",  value: "Premium Pack" },
    18: { type: "coins", value: "300" },
    20: { type: "item",  value: "Rare сфера", grade: "Rare" },
    25: { type: "pack",  value: "Elite Pack" },
    30: { type: "item",  value: "Exotic сфера", grade: "Exotic" },
    35: { type: "coins", value: "1000" },
    40: { type: "pack",  value: "VIP Pack" },
    45: { type: "item",  value: "Exotic сфера", grade: "Exotic" },
    50: { type: "item",  value: "Legacy сфера 👑", grade: "Legacy" },
  };

  const freeDefault: Reward = { type: "coins", value: level % 2 === 0 ? "25" : "50" };
  const premiumDefault: Reward = { type: "coins", value: level % 3 === 0 ? "100" : "75" };

  return {
    free: freeRewards[level] ?? freeDefault,
    premium: premiumRewards[level] ?? premiumDefault,
  };
}

const GRADE_COLORS: Record<string, string> = {
  Stock: "text-slate-300", Refined: "text-blue-300", Rare: "text-purple-300",
  Exotic: "text-pink-300", Legacy: "text-amber-300",
};

function RewardBadge({ reward, unlocked }: { reward: Reward; unlocked: boolean }) {
  const bg = !unlocked ? "bg-[#1a1a28] border-[#2a2a3e]" :
    reward.grade === "Legacy" ? "bg-amber-900/30 border-amber-500/40" :
    reward.grade === "Exotic" ? "bg-pink-900/30 border-pink-500/40" :
    reward.grade === "Rare" ? "bg-purple-900/30 border-purple-500/40" :
    reward.type === "pack" ? "bg-blue-900/30 border-blue-500/40" :
    "bg-[#1a2a1a] border-green-700/30";

  const emoji = reward.type === "coins" ? "💰" :
    reward.grade === "Legacy" ? "👑" : reward.grade === "Exotic" ? "🌸" :
    reward.grade === "Rare" ? "🟣" : reward.grade === "Refined" ? "🔵" :
    reward.type === "pack" ? "📦" : "⚫";

  return (
    <div className={`border rounded-xl p-1.5 text-center min-w-[52px] relative ${bg}`}>
      {!unlocked && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
          <Lock className="w-3 h-3 text-slate-600" />
        </div>
      )}
      <p className="text-base leading-none mb-0.5">{emoji}</p>
      <p className={`text-[8px] font-bold leading-tight ${reward.grade ? GRADE_COLORS[reward.grade] : "text-slate-300"}`}>
        {reward.type === "coins" ? `${reward.value}₵` : reward.type === "pack" ? "Pack" : reward.value.split(" ")[0]}
      </p>
    </div>
  );
}

export default function BattlePass() {
  const navigate = useNavigate();
  const [hasPremium] = useState(false); // test: no premium

  const xpProgress = CURRENT_XP % XP_PER_LEVEL;
  const xpPercent = (xpProgress / XP_PER_LEVEL) * 100;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-8">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" /> Battle Pass
          </h1>
          <p className="text-xs text-slate-500">Сезон 1 · Digital Souls</p>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Current level card */}
        <div className="bg-gradient-to-br from-[#1a0f28] to-[#120d1a] border border-purple-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400">Поточний рівень</p>
              <p className="text-3xl font-bold text-white">{CURRENT_LEVEL}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">До наступного</p>
              <p className="text-sm font-bold text-purple-400">{XP_PER_LEVEL - xpProgress} XP</p>
            </div>
          </div>
          {/* XP bar */}
          <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
              style={{ width: `${xpPercent}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-1">{xpProgress} / {XP_PER_LEVEL} XP</p>
        </div>

        {/* Premium CTA */}
        {!hasPremium && (
          <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 border border-amber-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <Crown className="w-8 h-8 text-amber-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-white text-sm">Premium Battle Pass</p>
                <p className="text-xs text-slate-400">Всі нагороди · Legacy на 50 рівні</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1 text-amber-400 font-bold text-sm mb-1">
                  <Star className="w-3.5 h-3.5" />200
                </div>
                <Button size="sm" className="h-7 text-xs px-3 bg-amber-600 hover:bg-amber-700 rounded-xl font-bold"
                  onClick={() => alert("Незабаром!")}>Купити</Button>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#1a2a1a] border border-green-700/50" />
            <span className="text-slate-400">Free</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-900/50 border border-amber-700/50" />
            <span className="text-slate-400">Premium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-purple-600" />
            <span className="text-slate-400">Отримано</span>
          </div>
        </div>

        {/* Levels */}
        <div className="space-y-1">
          {Array.from({ length: 50 }).map((_, i) => {
            const level = i + 1;
            const isCompleted = level < CURRENT_LEVEL;
            const isCurrent = level === CURRENT_LEVEL;
            const { free, premium } = getReward(level);
            const isMilestone = level % 5 === 0;

            return (
              <div key={level}
                className={`flex items-center gap-2 p-2 rounded-xl transition-all ${
                  isCurrent ? "bg-purple-900/30 border border-purple-500/40" :
                  isCompleted ? "bg-[#0d0d14]" : "bg-[#0a0a0f]"
                } ${isMilestone ? "border border-[#2a2a3e]" : ""}`}>

                {/* Level number */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isCompleted ? "bg-purple-600 text-white" :
                  isCurrent ? "bg-purple-600/50 text-purple-200 ring-2 ring-purple-500" :
                  "bg-[#1a1a28] text-slate-500"
                }`}>
                  {isCompleted ? "✓" : level}
                </div>

                {/* Progress line */}
                <div className={`w-1 h-8 rounded-full flex-shrink-0 ${isCompleted ? "bg-purple-600" : "bg-[#1e1e2e]"}`} />

                {/* Free reward */}
                <RewardBadge reward={free} unlocked={isCompleted || isCurrent} />

                <div className="flex-1" />

                {/* Premium reward */}
                <div className="relative">
                  <RewardBadge reward={premium} unlocked={hasPremium && (isCompleted || isCurrent)} />
                  {!hasPremium && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                      <Crown className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>

                {/* XP label for milestones */}
                {isMilestone && (
                  <div className="text-[9px] text-amber-400 font-bold flex-shrink-0">🏆</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info */}
        <Card className="bg-[#12121a] border-[#1e1e2e] rounded-2xl p-4 text-center">
          <p className="text-white font-bold text-sm mb-1">Як отримати XP?</p>
          <div className="space-y-1 text-xs text-slate-400">
            <p>📦 Відкрити пак → +10 XP</p>
            <p>🛒 Продати предмет → +5 XP</p>
            <p>🎡 Колесо фортуни → +15 XP</p>
            <p>🔥 Burn контракт → +25 XP</p>
            <p>📅 Щоденний вхід → +20 XP</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
