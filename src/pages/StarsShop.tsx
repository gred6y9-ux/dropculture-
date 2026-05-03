import { useState } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, Star, Package, Trophy, Flame, Zap, Box, Receipt, Sparkles } from "lucide-react";
import { toast } from "@/components/Toast";

const PRODUCT_DESIGN: Record<string, { gradient: string; border: string; emoji: string; iconBg: string; popular?: boolean }> = {
  stars_50:    { gradient: "from-purple-900/30 to-purple-900/10",   border: "border-purple-500/30",  emoji: "⭐",  iconBg: "bg-purple-500/20" },
  stars_200:   { gradient: "from-purple-900/40 to-pink-900/20",     border: "border-purple-500/40",  emoji: "⭐",  iconBg: "bg-purple-500/20" },
  stars_500:   { gradient: "from-purple-900/50 to-pink-900/30",     border: "border-pink-500/40",    emoji: "💫", iconBg: "bg-pink-500/20", popular: true },
  stars_1000:  { gradient: "from-amber-900/40 to-orange-900/30",    border: "border-amber-500/40",   emoji: "✨", iconBg: "bg-amber-500/20" },
  pack_vip:        { gradient: "from-blue-900/40 to-indigo-900/30",    border: "border-blue-500/40",    emoji: "💎", iconBg: "bg-blue-500/20" },
  pack_legendary:  { gradient: "from-pink-900/40 to-purple-900/30",    border: "border-pink-500/40",    emoji: "🌸", iconBg: "bg-pink-500/20" },
  pack_mythic:     { gradient: "from-amber-900/50 to-yellow-900/30",   border: "border-amber-500/50",   emoji: "👑", iconBg: "bg-amber-500/20" },
  wheel_spin_vip:  { gradient: "from-emerald-900/30 to-teal-900/20",   border: "border-emerald-500/30", emoji: "🎡", iconBg: "bg-emerald-500/20" },
  battle_pass_premium: { gradient: "from-orange-900/40 to-red-900/30", border: "border-orange-500/40",  emoji: "🏆", iconBg: "bg-orange-500/20" },
  slots_500:    { gradient: "from-slate-800/50 to-slate-900/30",    border: "border-slate-500/30",   emoji: "📦", iconBg: "bg-slate-500/20" },
};

export default function StarsShop() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "stars" | "packs" | "extras">("all");
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  const { data: products } = trpc.payments.getProducts.useQuery(undefined, { enabled: isAuthenticated });
  const { data: profile } = trpc.game.getProfile.useQuery(undefined, { enabled: isAuthenticated });
  const { data: payments, refetch: refetchPayments } = trpc.payments.getMyPayments.useQuery(undefined, { enabled: isAuthenticated });

  const createInvoice = trpc.payments.createInvoice.useMutation({
    onSuccess: (data, vars) => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(data.invoiceUrl, (status: string) => {
          setPendingProductId(null);
          if (status === "paid") {
            toast.success("✅ Оплата успішна!", "Stars нараховано протягом кількох секунд");
            setTimeout(() => refetchPayments(), 2000);
          } else if (status === "cancelled") {
            toast.info("Оплату скасовано");
          } else if (status === "failed") {
            toast.error("❌ Помилка оплати");
          }
        });
      } else {
        // Fallback — open URL
        window.open(data.invoiceUrl, "_blank");
      }
    },
    onError: (err) => {
      setPendingProductId(null);
      toast.error("Помилка", err.message);
    },
  });

  const handleBuy = (productId: string) => {
    if (!confirm(`Купити цей продукт за Telegram Stars?`)) return;
    setPendingProductId(productId);
    createInvoice.mutate({ productId });
  };

  const filtered = (products ?? []).filter((p: any) => {
    if (tab === "all") return true;
    if (tab === "stars") return p.type === "stars";
    if (tab === "packs") return p.type === "pack";
    if (tab === "extras") return p.type === "wheel" || p.type === "battlepass" || p.type === "slots";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-6">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-base flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" /> Магазин
          </h1>
          <p className="text-xs text-slate-500">Купуй за Telegram Stars</p>
        </div>
        <div className="flex items-center gap-1.5 bg-[#1a1a28] rounded-xl px-3 py-1.5">
          <Star className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-purple-400 font-bold text-sm">{profile?.user?.stars ?? 0}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[
            { id: "all", label: "Все" },
            { id: "stars", label: "⭐ Stars" },
            { id: "packs", label: "🎁 VIP Паки" },
            { id: "extras", label: "✨ Extras" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                tab === t.id ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="px-4 space-y-2">
        {filtered.map((p: any) => {
          const design = PRODUCT_DESIGN[p.id] ?? PRODUCT_DESIGN.stars_50;
          const isPending = pendingProductId === p.id && createInvoice.isPending;

          return (
            <Card key={p.id} className={`bg-gradient-to-r ${design.gradient} border ${design.border} rounded-2xl p-3 relative overflow-hidden`}>
              {design.popular && (
                <div className="absolute top-0 right-3 bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-b-lg">
                  ПОПУЛЯРНЕ
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 ${design.iconBg} rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
                  {design.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">{p.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{p.description}</p>
                  {p.type === "stars" && p.bonus > 0 && (
                    <p className="text-[10px] text-green-400 font-bold mt-0.5">
                      +{p.bonus} bonus = всього {p.starsAmount + p.bonus} ⭐
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => handleBuy(p.id)}
                  disabled={isPending}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs flex-shrink-0 h-9 px-3 font-bold"
                >
                  {isPending ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    <>
                      <Star className="w-3 h-3 mr-1 text-amber-400" />
                      {p.starsAmount}
                    </>
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent payments */}
      {payments && payments.length > 0 && (
        <div className="px-4 mt-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Receipt className="w-3.5 h-3.5" /> Останні покупки
          </p>
          <div className="space-y-1.5">
            {payments.slice(0, 10).map((pm: any) => (
              <Card key={pm.id} className="bg-[#12121a] border-[#1e1e2e] p-2.5 rounded-xl">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold truncate">{pm.productId}</p>
                    <p className="text-[10px] text-slate-500">{new Date(pm.createdAt).toLocaleString("uk-UA")}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-amber-400 font-bold">⭐ {pm.starsAmount}</p>
                    <p className={`text-[9px] font-bold ${
                      pm.status === "completed" ? "text-green-400" :
                      pm.status === "pending" ? "text-amber-400" :
                      pm.status === "failed" ? "text-red-400" : "text-slate-500"
                    }`}>
                      {pm.status === "completed" ? "✓ Завершено" :
                       pm.status === "pending" ? "⏱ Очікує" :
                       pm.status === "failed" ? "✗ Помилка" : "Refund"}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="px-4 mt-6">
        <Card className="bg-[#12121a] border-[#1e1e2e] p-3 rounded-2xl">
          <p className="text-xs text-slate-400 leading-relaxed">
            💡 <span className="text-white font-bold">Як це працює:</span> Натисни на товар → відкриється Telegram payment dialog → оплати в Stars → нагорода автоматично нараховується.
          </p>
        </Card>
      </div>
    </div>
  );
}
