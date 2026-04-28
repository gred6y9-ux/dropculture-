import { useState } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Zap, ShoppingBag, ArrowUpCircle } from "lucide-react";
import { toast } from "@/components/Toast";

const GRADE_COLORS: Record<string, { card: string; text: string; emoji: string }> = {
  Stock:   { card: "from-slate-800 to-slate-900",   text: "text-slate-300",  emoji: "⚫" },
  Refined: { card: "from-blue-800 to-blue-900",     text: "text-blue-300",   emoji: "🔵" },
  Rare:    { card: "from-purple-800 to-purple-900", text: "text-purple-300", emoji: "🟣" },
  Exotic:  { card: "from-pink-800 to-pink-900",     text: "text-pink-300",   emoji: "🌸" },
  Legacy:  { card: "from-amber-700 to-amber-900",   text: "text-amber-300",  emoji: "👑" },
};

const UPGRADE_COSTS: Record<string, number> = {
  Stock: 80, Refined: 300, Rare: 1200, Exotic: 4000,
};

function getFloatLabel(f: number): string {
  if (f <= 0.01) return "Pristine ✨";
  if (f <= 0.15) return "Factory New";
  if (f <= 0.38) return "Minimal Wear";
  if (f <= 0.50) return "Field-Tested";
  return "Corrupted 💀";
}

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useTelegramAuth();
  const [showSellForm, setShowSellForm] = useState(false);
  const [sellPrice, setSellPrice] = useState("");

  const { data: inventory, refetch } = trpc.game.getInventory.useQuery({});
  const item = inventory?.find((i: any) => i.id === Number(id));
  const grade = (item as any)?.template?.grade ?? "Stock";
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.Stock;
  const upgradeCost = UPGRADE_COSTS[grade];
  const floatVal = (item as any)?.floatVal ?? 0;
  const buyoutPrice = Math.floor(((item as any)?.marketPrice ?? 0) * 0.60);

  const listItem = trpc.market.listItems.useMutation({
    onSuccess: () => {
      refetch(); setShowSellForm(false); setSellPrice("");
      toast.success("✅ Виставлено на маркет!", "Чекай покупця");
    },
    onError: (err) => toast.error("Помилка", err.message),
  });

  const sellToPlatform = trpc.game.sellToPlatform.useMutation({
    onSuccess: (data) => {
      refetch();
      toast.success(`💰 Продано за ${data.coinsReceived.toLocaleString()} монет!`, data.itemName ?? "");
      navigate("/inventory");
    },
    onError: (err) => toast.error("Помилка", err.message),
  });

  const upgradeItem = trpc.game.upgradeItem.useMutation({
    onSuccess: (data) => {
      refetch();
      if (data.success) {
        toast.success(`🎉 Апгрейд вдався!`, `Тепер ${data.newGrade} · Витрачено ${data.coinsSpent} монет`);
        navigate("/inventory");
      } else {
        toast.error("💸 Апгрейд не вдався", `${data.coinsSpent} монет спалено`);
      }
    },
    onError: (err) => toast.error("Помилка", err.message),
  });

  if (!item) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-3">📦</p>
        <p className="text-slate-400 mb-4">Предмет не знайдено</p>
        <Button onClick={() => navigate("/inventory")} className="bg-purple-600 rounded-2xl">← Інвентар</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-8">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-base">Деталі предмета</h1>
      </div>

      <div className="px-4 space-y-3">
        {/* Main card */}
        <div className={`bg-gradient-to-br ${colors.card} rounded-3xl p-6 text-center shadow-2xl`}>
          <div className="text-7xl mb-3">{colors.emoji}</div>
          <h2 className="text-xl font-bold text-white mb-1">{(item as any).template?.name}</h2>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${colors.text} bg-black/20 mb-2`}>{grade}</span>
          <p className="text-slate-400 text-xs">{(item as any).template?.description}</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Float", value: floatVal.toFixed(4), sub: getFloatLabel(floatVal) },
            { label: "Ринкова ціна", value: `${((item as any).marketPrice ?? 0).toLocaleString()} ₵`, sub: "монет" },
            { label: "Pattern Seed", value: `#${(item as any).patternSeed}`, sub: "Унікальний візерунок" },
            { label: "Serial #", value: `#${(item as any).serialNum}`, sub: "Серійний номер" },
          ].map(s => (
            <Card key={s.label} className="bg-[#12121a] border-[#1e1e2e] p-3 rounded-2xl">
              <p className="text-[10px] text-slate-500 mb-0.5">{s.label}</p>
              <p className="font-bold text-white text-sm">{s.value}</p>
              <p className="text-[9px] text-slate-600 mt-0.5">{s.sub}</p>
            </Card>
          ))}
        </div>

        {/* Float bar */}
        <Card className="bg-[#12121a] border-[#1e1e2e] p-3 rounded-2xl">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
            <span>Pristine 0.00</span><span>1.00 Corrupted</span>
          </div>
          <div className="relative h-2.5 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 rounded-full">
            <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-[#0a0a0f]"
              style={{ left: `calc(${Math.min(floatVal * 100, 96)}% - 8px)` }} />
          </div>
          <p className="text-center text-xs text-slate-400 mt-1.5">{getFloatLabel(floatVal)} · {floatVal.toFixed(4)}</p>
        </Card>

        {/* Actions */}
        {!(item as any).isListed ? (
          <div className="space-y-2">
            {/* List on market */}
            {!showSellForm ? (
              <Button onClick={() => setShowSellForm(true)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 rounded-2xl h-12 font-bold">
                <ShoppingBag className="w-4 h-4 mr-2" /> Виставити на маркет
              </Button>
            ) : (
              <Card className="bg-[#12121a] border-purple-500/30 p-4 rounded-2xl space-y-3">
                <p className="font-bold text-white text-sm">💰 Ціна в монетах</p>
                {(() => {
                  const marketPrice = (item as any).marketPrice ?? 0;
                  const minPrice = Math.floor(marketPrice * 0.5);
                  const maxPrice = Math.floor(marketPrice * 1.5);
                  return (
                    <>
                      <input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                        placeholder={`${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`}
                        className="w-full bg-[#0a0a0f] border border-[#2a2a3e] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500" />
                      <div className="flex gap-1.5">
                        <button onClick={() => setSellPrice(String(minPrice))}
                          className="flex-1 text-[10px] bg-[#1a1a28] hover:bg-[#2a2a3e] py-1.5 rounded-lg text-slate-400 transition">
                          Мін {minPrice.toLocaleString()}
                        </button>
                        <button onClick={() => setSellPrice(String(marketPrice))}
                          className="flex-1 text-[10px] bg-purple-600/20 hover:bg-purple-600/30 py-1.5 rounded-lg text-purple-300 transition">
                          Ринок {marketPrice.toLocaleString()}
                        </button>
                        <button onClick={() => setSellPrice(String(maxPrice))}
                          className="flex-1 text-[10px] bg-[#1a1a28] hover:bg-[#2a2a3e] py-1.5 rounded-lg text-slate-400 transition">
                          Макс {maxPrice.toLocaleString()}
                        </button>
                      </div>
                      {sellPrice && (() => {
                        const p = Number(sellPrice);
                        const tooLow = p < minPrice;
                        const tooHigh = p > maxPrice;
                        if (tooLow) return <p className="text-xs text-red-400">⚠ Мінімум {minPrice.toLocaleString()}₵ (50% ринку)</p>;
                        if (tooHigh) return <p className="text-xs text-red-400">⚠ Максимум {maxPrice.toLocaleString()}₵ (150% ринку)</p>;
                        return (
                          <p className="text-xs text-slate-400">
                            Ти отримаєш <span className="text-yellow-400 font-bold">{Math.floor(p * 0.95).toLocaleString()}</span> монет після комісії 5%
                          </p>
                        );
                      })()}
                    </>
                  );
                })()}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => { setShowSellForm(false); setSellPrice(""); }}
                    className="border-[#2a2a3e] text-slate-400 rounded-xl">Скасувати</Button>
                  <Button onClick={() => {
                    if (!sellPrice || Number(sellPrice) < 1) { toast.error("Введи ціну"); return; }
                    const marketPrice = (item as any).marketPrice ?? 0;
                    const minPrice = Math.floor(marketPrice * 0.5);
                    const maxPrice = Math.floor(marketPrice * 1.5);
                    if (Number(sellPrice) < minPrice) { toast.error("Ціна занадто низька", `Мінімум ${minPrice.toLocaleString()}₵`); return; }
                    if (Number(sellPrice) > maxPrice) { toast.error("Ціна занадто висока", `Максимум ${maxPrice.toLocaleString()}₵`); return; }
                    listItem.mutate({ itemId: Number(id), price: Number(sellPrice), currency: "coins" });
                  }} disabled={listItem.isPending} className="bg-purple-600 hover:bg-purple-700 rounded-xl font-bold">
                    {listItem.isPending ? "..." : "Виставити"}
                  </Button>
                </div>
              </Card>
            )}

            {/* Upgrade */}
            {grade !== "Legacy" && upgradeCost && (
              <Button onClick={() => {
                if ((user as any)?.coins < upgradeCost) { toast.error("Недостатньо монет", `Потрібно ${upgradeCost} монет`); return; }
                upgradeItem.mutate({ itemId: Number(id) });
              }} disabled={upgradeItem.isPending}
                variant="outline"
                className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-500/10 rounded-2xl h-12 font-bold">
                <ArrowUpCircle className="w-4 h-4 mr-2" />
                Апгрейд до {grade === "Stock" ? "Refined" : grade === "Refined" ? "Rare" : grade === "Rare" ? "Exotic" : "Legacy"}
                <span className="ml-2 text-xs opacity-60">·{upgradeCost}₵ · 40%</span>
              </Button>
            )}

            {/* Sell to platform */}
            <Button onClick={() => sellToPlatform.mutate({ itemId: Number(id) })} disabled={sellToPlatform.isPending}
              variant="outline"
              className="w-full border-slate-700 text-slate-400 hover:bg-slate-500/10 rounded-2xl h-12">
              <Zap className="w-4 h-4 mr-2" />
              Продати платформі · {buyoutPrice.toLocaleString()} монет
            </Button>
          </div>
        ) : (
          <Card className="bg-[#12121a] border-purple-500/20 p-4 rounded-2xl text-center">
            <ShoppingBag className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-white font-bold text-sm">На маркеті</p>
            <p className="text-slate-500 text-xs mt-1">Очікує покупця</p>
          </Card>
        )}
      </div>
    </div>
  );
}
