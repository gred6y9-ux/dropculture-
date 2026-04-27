import { useState } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Zap, TrendingUp, Flame, ShoppingBag, ArrowUpCircle } from "lucide-react";

const GRADE_COLORS: Record<string, { card: string; text: string; glow: string; emoji: string }> = {
  Stock:   { card: "from-slate-800 to-slate-900",   text: "text-slate-300",   glow: "shadow-slate-500/20",  emoji: "⚫" },
  Refined: { card: "from-blue-800 to-blue-900",     text: "text-blue-300",    glow: "shadow-blue-500/30",   emoji: "🔵" },
  Rare:    { card: "from-purple-800 to-purple-900", text: "text-purple-300",  glow: "shadow-purple-500/30", emoji: "🟣" },
  Exotic:  { card: "from-pink-800 to-pink-900",     text: "text-pink-300",    glow: "shadow-pink-500/40",   emoji: "🌸" },
  Legacy:  { card: "from-amber-700 to-amber-900",   text: "text-amber-300",   glow: "shadow-amber-500/50",  emoji: "👑" },
};

const UPGRADE_COSTS: Record<string, number> = {
  Stock: 80, Refined: 300, Rare: 1200, Exotic: 4000,
};

const FLOAT_LABELS: Record<string, string> = {
  "0.00-0.01": "Pristine ✨",
  "0.01-0.15": "Factory New",
  "0.15-0.38": "Minimal Wear",
  "0.38-0.50": "Field-Tested",
  "0.50-1.00": "Corrupted 💀",
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
  const [action, setAction] = useState<"idle" | "selling" | "upgrading" | "burning" | "buyout">("idle");

  const { data: inventory, refetch } = trpc.game.getInventory.useQuery({});
  const item = inventory?.find((i: any) => i.id === Number(id));
  const grade = (item as any)?.template?.grade ?? "Stock";
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.Stock;
  const upgradeCost = UPGRADE_COSTS[grade];

  const listItem = trpc.market.listItems.useMutation({
    onSuccess: () => { refetch(); setShowSellForm(false); setSellPrice(""); alert("✅ Виставлено на маркет!"); },
    onError: (err) => alert("❌ " + err.message),
  });

  const sellToPlatform = trpc.game.sellToPlatform.useMutation({
    onSuccess: (data) => { refetch(); navigate("/inventory"); alert(`✅ Продано за ${data.coinsReceived} монет!`); },
    onError: (err) => alert("❌ " + err.message),
  });

  const upgradeItem = trpc.game.upgradeItem.useMutation({
    onSuccess: (data) => {
      refetch();
      if (data.success) {
        alert(`🎉 Апгрейд вдався! Тепер ${data.newGrade}. Витрачено ${data.coinsSpent} монет.`);
        navigate("/inventory");
      } else {
        alert(`💸 Апгрейд не вдався. ${data.coinsSpent} монет витрачено. Бувай...`);
      }
    },
    onError: (err) => alert("❌ " + err.message),
  });

  if (!item) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-400 mb-4">Предмет не знайдено</p>
        <Button onClick={() => navigate("/inventory")} className="bg-purple-600">← Інвентар</Button>
      </div>
    </div>
  );

  const buyoutPrice = Math.floor(((item as any).marketPrice ?? 0) * 0.60);
  const floatVal = (item as any).floatVal ?? 0;
  const floatLabel = getFloatLabel(floatVal);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-8">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-base">Деталі предмета</h1>
      </div>

      <div className="px-4 space-y-4">
        {/* Item Card */}
        <div className={`bg-gradient-to-br ${colors.card} rounded-3xl p-6 shadow-2xl ${colors.glow} text-center`}>
          <div className="text-7xl mb-4">{colors.emoji}</div>
          <h2 className="text-xl font-bold text-white mb-1">{(item as any).template?.name}</h2>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${colors.text} bg-black/20 mb-4`}>{grade}</span>
          <p className="text-slate-300 text-sm">{(item as any).template?.description}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Float", value: floatVal.toFixed(4), sub: floatLabel },
            { label: "Pattern Seed", value: `#${(item as any).patternSeed}`, sub: "Унікальний" },
            { label: "Serial #", value: `#${(item as any).serialNum}`, sub: "Серійний" },
            { label: "Ринкова ціна", value: `${(item as any).marketPrice?.toLocaleString()} ₵`, sub: "Монет" },
          ].map(s => (
            <Card key={s.label} className="bg-[#12121a] border-[#1e1e2e] p-3">
              <p className="text-xs text-slate-500 mb-0.5">{s.label}</p>
              <p className="font-bold text-white text-sm">{s.value}</p>
              <p className="text-[10px] text-slate-500">{s.sub}</p>
            </Card>
          ))}
        </div>

        {/* Float Bar */}
        <Card className="bg-[#12121a] border-[#1e1e2e] p-4">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>0.00 Pristine</span><span>1.00 Corrupted</span>
          </div>
          <div className="relative h-2 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full">
            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-slate-800 transition-all"
              style={{ left: `calc(${floatVal * 100}% - 6px)` }} />
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">{floatLabel} — {floatVal.toFixed(4)}</p>
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
              <Card className="bg-[#12121a] border-[#1e1e2e] p-4 space-y-3">
                <p className="font-bold text-white text-sm">Ціна продажу (монет)</p>
                <input
                  type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                  placeholder={`Мін: ${Math.floor((item as any).marketPrice * 0.5)}`}
                  className="w-full bg-[#0a0a0f] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                />
                <p className="text-xs text-slate-500">Ти отримаєш {sellPrice ? Math.floor(Number(sellPrice) * 0.95).toLocaleString() : "—"} монет (комісія 5%)</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => { setShowSellForm(false); setSellPrice(""); }}
                    className="border-[#2a2a3e] text-slate-400 rounded-xl">Скасувати</Button>
                  <Button onClick={() => {
                    if (!sellPrice || Number(sellPrice) < 1) return alert("Введи ціну");
                    listItem.mutate({ itemId: Number(id), price: Number(sellPrice), currency: "coins" });
                  }} disabled={listItem.isPending}
                    className="bg-purple-600 hover:bg-purple-700 rounded-xl font-bold">
                    {listItem.isPending ? "..." : "Виставити"}
                  </Button>
                </div>
              </Card>
            )}

            {/* Upgrade */}
            {grade !== "Legacy" && upgradeCost && (
              <Button onClick={() => {
                if (!confirm(`Апгрейд коштує ${upgradeCost} монет. Шанс успіху 40%. Монети витрачаються у будь-якому разі. Продовжити?`)) return;
                upgradeItem.mutate({ itemId: Number(id) });
              }} disabled={upgradeItem.isPending || (user as any)?.coins < upgradeCost}
                variant="outline"
                className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-500/10 rounded-2xl h-12 font-bold disabled:opacity-40">
                <ArrowUpCircle className="w-4 h-4 mr-2" />
                Апгрейд → {grade === "Stock" ? "Refined" : grade === "Refined" ? "Rare" : grade === "Rare" ? "Exotic" : "Legacy"}
                <span className="ml-2 text-xs text-slate-500">({upgradeCost} монет, 40%)</span>
              </Button>
            )}

            {/* Sell to platform */}
            <Button onClick={() => {
              if (!confirm(`Продати платформі за ${buyoutPrice} монет? (60% від ринкової ціни)\nЦе остаточно.`)) return;
              sellToPlatform.mutate({ itemId: Number(id) });
            }} disabled={sellToPlatform.isPending}
              variant="outline"
              className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-2xl h-12 font-bold">
              <Zap className="w-4 h-4 mr-2" />
              Продати платформі за {buyoutPrice.toLocaleString()} монет
            </Button>
          </div>
        ) : (
          <Card className="bg-[#12121a] border-[#1e1e2e] p-4 text-center">
            <ShoppingBag className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-white font-bold text-sm">Предмет на маркеті</p>
            <p className="text-slate-500 text-xs mt-1">Зачекай поки хтось купить або зніми з продажу</p>
          </Card>
        )}
      </div>
    </div>
  );
}
