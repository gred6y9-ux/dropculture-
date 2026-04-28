import { useState } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, Flame, Plus, X, ArrowRight, Zap } from "lucide-react";
import { toast } from "@/components/Toast";

const GRADE_COLORS: Record<string, { card: string; text: string; ring: string }> = {
  Stock:   { card: "bg-[#12121a] border-slate-700/50",  text: "text-slate-300",   ring: "ring-slate-500" },
  Refined: { card: "bg-[#0d1520] border-blue-700/40",   text: "text-blue-300",    ring: "ring-blue-500" },
  Rare:    { card: "bg-[#130d20] border-purple-700/40", text: "text-purple-300",  ring: "ring-purple-500" },
  Exotic:  { card: "bg-[#1a0d18] border-pink-700/40",   text: "text-pink-300",    ring: "ring-pink-500" },
  Legacy:  { card: "bg-[#1a1200] border-amber-600/50",  text: "text-amber-300",   ring: "ring-amber-500" },
};

const GRADE_EMOJI: Record<string, string> = {
  Stock: "⚫", Refined: "🔵", Rare: "🟣", Exotic: "🌸", Legacy: "👑",
};

const NEXT_GRADE: Record<string, string> = {
  Stock: "Refined", Refined: "Rare", Rare: "Exotic", Exotic: "Legacy",
};

const BURN_FEES: Record<string, number> = {
  Stock: 80, Refined: 300, Rare: 1200, Exotic: 4000,
};

export default function TradeUp() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pickerGrade, setPickerGrade] = useState<string | null>(null);

  const { data: items, refetch } = trpc.game.getInventory.useQuery({}, { enabled: isAuthenticated });
  const { data: profile, refetch: refetchProfile } = trpc.game.getProfile.useQuery(undefined, { enabled: isAuthenticated });

  const burnMutation = trpc.game.burnItems.useMutation({
    onSuccess: (data: any) => {
      refetch();
      refetchProfile();
      setSelectedIds(new Set());
      setPickerGrade(null);
      toast.success(
        `🔥 Trade-up успішний!`,
        `Отримано ${data?.newGrade} предмет`
      );
      navigate("/inventory");
    },
    onError: (err) => toast.error("Помилка", err.message),
  });

  // Available items (not listed) of the selected grade
  const availableItems = (items ?? []).filter((i: any) =>
    !i.isListed && i.template?.grade === pickerGrade
  );

  const selectedItems = (items ?? []).filter((i: any) => selectedIds.has(i.id));
  const selectedGrade = selectedItems[0]?.template?.grade ?? null;
  const burnFee = selectedGrade ? BURN_FEES[selectedGrade] ?? 0 : 0;
  const nextGrade = selectedGrade ? NEXT_GRADE[selectedGrade] : null;
  const canBurn = selectedItems.length === 5 && !!nextGrade;
  const userCoins = profile?.user?.coins ?? 0;
  const hasEnoughCoins = userCoins >= burnFee;

  // Stats: total value being burned vs new item estimate
  const totalBurnValue = selectedItems.reduce((s: number, i: any) => s + (i.marketPrice ?? 0), 0);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      else toast.error("Максимум 5 предметів", "Прибери щось перед додаванням");
      return next;
    });
  };

  const startPicker = (grade: string) => {
    setPickerGrade(grade);
    setSelectedIds(new Set());
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-6">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" /> Trade-Up
          </h1>
          <p className="text-xs text-slate-500">Спали 5 предметів — отримай 1 вищого grade</p>
        </div>
        <div className="flex items-center gap-1 text-yellow-400 font-bold text-sm">
          <Zap className="w-3.5 h-3.5" />{userCoins.toLocaleString()}
        </div>
      </div>

      {/* Step 1: Pick grade */}
      {!pickerGrade && (
        <div className="px-4 space-y-4">
          <Card className="bg-gradient-to-r from-orange-900/30 to-red-900/30 border-orange-500/30 p-4 rounded-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Flame className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-white text-sm mb-1">Як це працює</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Збери 5 предметів одного рівня → плати фі → отримай 1 предмет наступного рівня.
                  Шанси на конкретний предмет — рівні.
                </p>
              </div>
            </div>
          </Card>

          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Вибери grade для апгрейду</p>

          {["Stock", "Refined", "Rare", "Exotic"].map(grade => {
            const colors = GRADE_COLORS[grade];
            const fee = BURN_FEES[grade];
            const next = NEXT_GRADE[grade];
            const ownedCount = (items ?? []).filter((i: any) =>
              !i.isListed && i.template?.grade === grade
            ).length;
            const canDo = ownedCount >= 5;
            return (
              <Card key={grade}
                onClick={() => canDo && startPicker(grade)}
                className={`${colors.card} border p-4 rounded-2xl flex items-center gap-3 cursor-pointer transition-all
                  ${canDo ? "active:scale-95 hover:border-purple-500/30" : "opacity-50 cursor-not-allowed"}`}>
                <div className="text-3xl flex-shrink-0">{GRADE_EMOJI[grade]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white text-sm">{grade}</p>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <p className={`font-bold text-sm ${GRADE_COLORS[next].text}`}>{next}</p>
                    <span className="text-xs">{GRADE_EMOJI[next]}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Вартість: {fee.toLocaleString()}₵</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-bold ${canDo ? "text-white" : "text-slate-600"}`}>{ownedCount}/5</p>
                  <p className="text-[9px] text-slate-500">в інвентарі</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Step 2: Pick items */}
      {pickerGrade && (
        <div className="px-4 space-y-3">
          {/* Header back */}
          <button onClick={() => { setPickerGrade(null); setSelectedIds(new Set()); }}
            className="flex items-center gap-1 text-purple-400 text-xs">
            ← Інший grade
          </button>

          {/* Slots */}
          <Card className="bg-[#12121a] border-[#1e1e2e] p-3 rounded-2xl">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Слоти ({selectedIds.size}/5)</p>
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => {
                const item = selectedItems[i];
                if (!item) {
                  return (
                    <div key={i} className="aspect-[2/3] rounded-lg border-2 border-dashed border-[#2a2a3e] flex items-center justify-center bg-[#0a0a0f]">
                      <Plus className="w-4 h-4 text-slate-600" />
                    </div>
                  );
                }
                const grade = item.template?.grade ?? "Stock";
                const colors = GRADE_COLORS[grade];
                return (
                  <div key={i}
                    onClick={() => toggleSelect(item.id)}
                    className={`relative aspect-[2/3] rounded-lg border ${colors.card} cursor-pointer p-1 flex flex-col items-center justify-center hover:scale-95 transition`}>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center z-10">
                      <X className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-base">{GRADE_EMOJI[grade]}</span>
                    <p className="text-[7px] font-bold text-white text-center leading-tight line-clamp-1">{item.template?.name}</p>
                    <p className="text-[7px] text-yellow-400 font-bold">{(item.marketPrice ?? 0).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Result preview */}
          {selectedItems.length > 0 && (
            <Card className="bg-gradient-to-br from-[#1a0f28] to-[#12121a] border-purple-500/30 p-3 rounded-2xl">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <p className="text-slate-400 mb-0.5">Спалю</p>
                  <p className="text-white font-bold">{selectedItems.length}× {pickerGrade} {GRADE_EMOJI[pickerGrade]}</p>
                  <p className="text-[9px] text-slate-500">Вартість {totalBurnValue.toLocaleString()}₵</p>
                </div>
                <ArrowRight className="w-5 h-5 text-purple-400" />
                <div className="text-right">
                  <p className="text-slate-400 mb-0.5">Отримаю</p>
                  <p className="text-white font-bold">1× {nextGrade} {GRADE_EMOJI[nextGrade!]}</p>
                  <p className="text-[9px] text-yellow-400">Фі: {burnFee.toLocaleString()}₵</p>
                </div>
              </div>
              {!hasEnoughCoins && (
                <p className="text-xs text-red-400 mt-2 text-center">⚠ Недостатньо монет ({userCoins.toLocaleString()}/{burnFee.toLocaleString()})</p>
              )}
            </Card>
          )}

          {/* Burn button */}
          <Button
            onClick={() => {
              if (!confirm(`Спалити 5 ${pickerGrade} предметів за ${burnFee}₵ і отримати 1 ${nextGrade}?`)) return;
              burnMutation.mutate({ itemIds: Array.from(selectedIds) });
            }}
            disabled={!canBurn || !hasEnoughCoins || burnMutation.isPending}
            className="w-full h-12 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 rounded-xl font-bold">
            <Flame className="w-4 h-4 mr-2" />
            {burnMutation.isPending ? "..." : `Trade-Up · ${burnFee.toLocaleString()}₵`}
          </Button>

          {/* Available items pool */}
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4">
            Доступні {pickerGrade} {GRADE_EMOJI[pickerGrade]} ({availableItems.length})
          </p>
          {availableItems.length === 0 ? (
            <Card className="bg-[#12121a] border-[#1e1e2e] p-6 rounded-2xl text-center">
              <p className="text-slate-400 text-sm">Немає {pickerGrade} предметів в інвентарі</p>
              <Button onClick={() => navigate("/pack-open")} className="mt-3 bg-purple-600 rounded-xl text-xs">
                Відкрити пак
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {availableItems.map((item: any) => {
                const grade = item.template?.grade ?? "Stock";
                const colors = GRADE_COLORS[grade];
                const isSelected = selectedIds.has(item.id);
                return (
                  <Card key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`${colors.card} border p-2 rounded-xl cursor-pointer transition-all
                      ${isSelected ? `ring-2 ${colors.ring} scale-95` : "hover:scale-105"}
                    `}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">{GRADE_EMOJI[grade]}</span>
                      {isSelected && (
                        <div className="w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-[8px] text-white font-bold">✓</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-white line-clamp-1">{item.template?.name}</p>
                    <p className="text-[8px] text-slate-500">#{item.serialNum?.toString().padStart(4, "0")}</p>
                    <p className="text-[9px] text-yellow-400 font-bold">{(item.marketPrice ?? 0).toLocaleString()}₵</p>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
