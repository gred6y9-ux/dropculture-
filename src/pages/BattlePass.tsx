import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, Star, Flame, Lock, Crown, Zap } from "lucide-react";

const CURRENT_LEVEL = 7;
const XP = 340;
const XP_PER = 100;

export default function BattlePass() {
  const navigate = useNavigate();
  const xpPct = ((XP % XP_PER) / XP_PER) * 100;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-8">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-base flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" /> Battle Pass</h1>
          <p className="text-xs text-slate-500">Сезон 1 · Digital Souls (ТЕСТ)</p>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Level card */}
        <div className="bg-gradient-to-br from-[#1a0f28] to-[#120d1a] border border-purple-500/30 rounded-2xl p-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Рівень</p>
              <p className="text-5xl font-black text-white leading-none">{CURRENT_LEVEL}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Наступний</p>
              <p className="text-2xl font-bold text-purple-400">{CURRENT_LEVEL + 1}</p>
              <p className="text-xs text-slate-500">{XP_PER - (XP % XP_PER)} XP</p>
            </div>
          </div>
          <div className="h-3 bg-[#1e1e2e] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
              style={{ width: `${xpPct}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-1">{XP % XP_PER} / {XP_PER} XP</p>
        </div>

        {/* Premium CTA */}
        <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
          <Crown className="w-8 h-8 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-white text-sm">Premium Battle Pass</p>
            <p className="text-xs text-slate-400">Ексклюзивні нагороди · Legacy на 50 рівні</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-1 text-amber-400 font-bold text-sm mb-1">
              <Star className="w-3.5 h-3.5" />200
            </div>
            <Button size="sm" className="h-7 text-xs px-3 bg-amber-600 hover:bg-amber-700 rounded-xl font-bold"
              onClick={() => alert("Незабаром!")}>Незабаром</Button>
          </div>
        </div>

        {/* XP sources */}
        <Card className="bg-[#12121a] border-[#1e1e2e] rounded-2xl p-4">
          <p className="font-bold text-white text-sm mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" />Як отримати XP</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["📦 Відкрити пак", "+10 XP"],
              ["🎡 Колесо фортуни", "+15 XP"],
              ["🛒 Продати предмет", "+5 XP"],
              ["🔥 Burn контракт", "+25 XP"],
              ["📅 Щоденний вхід", "+20 XP"],
              ["🏆 Купити в маркеті", "+3 XP"],
            ].map(([label, xp]) => (
              <div key={label} className="bg-[#0d0d14] rounded-xl p-2 flex items-center justify-between">
                <p className="text-xs text-slate-300">{label}</p>
                <p className="text-xs text-purple-400 font-bold">{xp}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Level list */}
        <div>
          <div className="flex gap-3 text-xs mb-3">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-purple-600" /><span className="text-slate-400">Виконано</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-purple-500/30 border border-purple-500" /><span className="text-slate-400">Поточний</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#1a1a28]" /><span className="text-slate-400">Заблоковано</span></div>
          </div>

          <div className="space-y-1">
            {Array.from({ length: 50 }).map((_, i) => {
              const lvl = i + 1;
              const done = lvl < CURRENT_LEVEL;
              const curr = lvl === CURRENT_LEVEL;
              const mile = lvl % 10 === 0;

              return (
                <div key={lvl} className={`flex items-center gap-2 px-2 py-2 rounded-xl transition-all ${
                  curr ? "bg-purple-900/30 border border-purple-500/40" :
                  done ? "bg-[#0d0d14]" : ""
                } ${mile ? "border border-amber-500/20" : ""}`}>
                  {/* Level badge */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    done ? "bg-purple-600 text-white" :
                    curr ? "bg-purple-500/30 text-white ring-2 ring-purple-500" :
                    "bg-[#1a1a28] text-slate-500"
                  }`}>
                    {done ? "✓" : lvl}
                  </div>

                  {/* Line */}
                  <div className={`w-0.5 h-9 rounded-full flex-shrink-0 ${done ? "bg-purple-600" : "bg-[#1e1e2e]"}`} />

                  {/* Free slot */}
                  <div className={`flex-1 h-9 rounded-xl flex items-center justify-center border ${
                    done || curr ? "bg-[#1a2a1a] border-green-700/30" : "bg-[#1a1a28] border-[#2a2a3e]"
                  }`}>
                    {done || curr ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">💰</span>
                        <span className="text-xs text-green-400 font-semibold">{lvl % 5 === 0 ? "250₵" : "50₵"}</span>
                      </div>
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </div>

                  {/* Milestone marker */}
                  {mile && <span className="text-amber-400 text-base flex-shrink-0">🏆</span>}

                  {/* Premium slot */}
                  <div className={`w-20 h-9 rounded-xl flex items-center justify-center border relative ${
                    false ? "bg-amber-900/30 border-amber-700/30" : "bg-[#120d08] border-amber-900/20"
                  }`}>
                    <Crown className="absolute -top-1 -right-1 w-3 h-3 text-amber-500" />
                    <Lock className="w-3.5 h-3.5 text-amber-900/60" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
