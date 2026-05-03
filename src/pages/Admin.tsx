import { useState } from "react";
import { useTelegramAuth } from "@/providers/telegram-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { ArrowLeft, Users, Activity, AlertTriangle, Settings, Send, Coins, Star, Shield, Search, X, TrendingUp } from "lucide-react";
import { toast } from "@/components/Toast";

type Tab = "dashboard" | "users" | "analytics" | "errors" | "broadcast" | "settings";

export default function Admin() {
  const { isAuthenticated } = useTelegramAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");

  const { data: whoami, isLoading: checking } = trpc.admin.whoami.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!whoami?.isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-6">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Доступ заборонено</h1>
        <p className="text-slate-400 text-sm mb-6 text-center">Ця сторінка тільки для адміністраторів</p>
        <Button onClick={() => navigate("/")} className="bg-purple-600 rounded-2xl">На головну</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-6">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" /> Admin Panel
          </h1>
          <p className="text-xs text-slate-500">{whoami.isOwner ? "Owner" : "Admin"} · TG {whoami.telegramId}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4 overflow-x-auto">
        <div className="flex gap-1.5">
          {[
            { id: "dashboard",  label: "📊", title: "Dashboard" },
            { id: "users",      label: "👥", title: "Users" },
            { id: "analytics",  label: "📈", title: "Analytics" },
            { id: "errors",     label: "🚨", title: "Errors" },
            { id: "broadcast",  label: "📢", title: "Broadcast" },
            { id: "settings",   label: "⚙️", title: "Settings" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5
                ${tab === t.id ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
              <span>{t.label}</span><span>{t.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "users" && <UsersTab />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "errors" && <ErrorsTab />}
        {tab === "broadcast" && <BroadcastTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

// ─── Dashboard Tab ──────────────────────────────────────────────
function DashboardTab() {
  const { data, isLoading } = trpc.admin.getDashboard.useQuery();

  if (isLoading) return <Loading />;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">👥 Користувачі</p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Всього" value={data.users.total} icon={<Users className="w-4 h-4 text-purple-400" />} />
        <StatCard label="DAU (24г)" value={data.users.dau} icon={<Activity className="w-4 h-4 text-green-400" />} accent="text-green-400" />
        <StatCard label="WAU (7д)" value={data.users.wau} icon={<Activity className="w-4 h-4 text-blue-400" />} />
        <StatCard label="MAU (30д)" value={data.users.mau} icon={<Activity className="w-4 h-4 text-amber-400" />} />
      </div>

      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4">💰 Економіка</p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Coins у обігу" value={data.users.totalCoinsInCirculation.toLocaleString()} icon={<Coins className="w-4 h-4 text-yellow-400" />} />
        <StatCard label="Stars у обігу" value={data.users.totalStarsInCirculation.toLocaleString()} icon={<Star className="w-4 h-4 text-purple-400" />} />
        <StatCard label="Предметів" value={data.items.total} />
        <StatCard label="Активних лотів" value={data.market.activeListings} />
      </div>

      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4">💵 Продажі (30д)</p>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Угод" value={data.revenue.transactions30d} />
        <StatCard label="Об'єм" value={data.revenue.volume30d.toLocaleString()} accent="text-yellow-400" />
        <StatCard label="Комісії" value={data.revenue.fees30d.toLocaleString()} accent="text-green-400" />
      </div>

      {data.errors.length > 0 && (
        <Card className="bg-red-900/20 border-red-500/30 p-3 rounded-2xl">
          <p className="font-bold text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Помилки за 24 год
          </p>
          {data.errors.map((e: any, i: number) => (
            <p key={i} className="text-xs text-slate-300 mt-1">
              <span className="text-red-400 font-mono">{e.source}:</span> {e.count} помилок
            </p>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Users Tab ──────────────────────────────────────────────────
function UsersTab() {
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const { data: users, refetch } = trpc.admin.searchUsers.useQuery({ query });

  const giveCoins = trpc.admin.giveCoins.useMutation({
    onSuccess: () => { refetch(); toast.success("✅ Монети нараховано"); },
    onError: (e) => toast.error("Помилка", e.message),
  });
  const giveStars = trpc.admin.giveStars.useMutation({
    onSuccess: () => { refetch(); toast.success("✅ Stars нараховано"); },
    onError: (e) => toast.error("Помилка", e.message),
  });
  const banUser = trpc.admin.banUser.useMutation({
    onSuccess: (_, vars) => { refetch(); toast.success(vars.banned ? "🚫 Користувача забанено" : "✅ Користувача розбанено"); },
    onError: (e) => toast.error("Помилка", e.message),
  });

  const handleGiveCoins = (userId: number) => {
    const amount = prompt("Скільки монет нарахувати? (мінус — забрати)");
    if (!amount) return;
    const reason = prompt("Причина (необов'язково):") ?? undefined;
    giveCoins.mutate({ userId, amount: parseInt(amount, 10), reason });
  };

  const handleGiveStars = (userId: number) => {
    const amount = prompt("Скільки Stars нарахувати? (мінус — забрати)");
    if (!amount) return;
    const reason = prompt("Причина (необов'язково):") ?? undefined;
    giveStars.mutate({ userId, amount: parseInt(amount, 10), reason });
  };

  const handleBan = (userId: number, currentlyBanned: boolean) => {
    const action = currentlyBanned ? "розбанити" : "забанити";
    if (!confirm(`Точно ${action} цього користувача?`)) return;
    const reason = !currentlyBanned ? prompt("Причина бану:") ?? "" : "";
    banUser.mutate({ userId, banned: !currentlyBanned, reason });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Пошук: username, ID, telegram_id"
          className="w-full bg-[#12121a] border border-[#1e1e2e] rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
        />
      </div>

      <p className="text-xs text-slate-500">Знайдено: {users?.length ?? 0}</p>

      <div className="space-y-2">
        {users?.map(u => (
          <Card key={u.id} className={`bg-[#12121a] border p-3 rounded-2xl ${u.banned ? "border-red-500/40" : "border-[#1e1e2e]"}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-white text-sm truncate">
                    {u.firstName ?? u.username ?? "?"}
                  </p>
                  {u.role === "admin" && <span className="text-[8px] bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                  {u.banned && <span className="text-[8px] bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded font-bold">BANNED</span>}
                </div>
                <p className="text-[10px] text-slate-500">@{u.username ?? "—"} · TG {u.telegramId} · ID {u.id}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-yellow-400 font-bold text-xs">{u.coins.toLocaleString()}₵</p>
                <p className="text-purple-400 font-bold text-xs">{u.stars}⭐</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Button size="sm" onClick={() => handleGiveCoins(u.id)}
                className="text-[10px] h-7 bg-yellow-700 hover:bg-yellow-600 rounded-lg">
                <Coins className="w-3 h-3 mr-1" />Coins
              </Button>
              <Button size="sm" onClick={() => handleGiveStars(u.id)}
                className="text-[10px] h-7 bg-purple-700 hover:bg-purple-600 rounded-lg">
                <Star className="w-3 h-3 mr-1" />Stars
              </Button>
              <Button size="sm" onClick={() => handleBan(u.id, u.banned)}
                className={`text-[10px] h-7 rounded-lg ${u.banned ? "bg-green-700 hover:bg-green-600" : "bg-red-700 hover:bg-red-600"}`}>
                {u.banned ? "Розбан" : "Бан"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Analytics Tab ──────────────────────────────────────────────
function AnalyticsTab() {
  const [hours, setHours] = useState(24);
  const { data, isLoading } = trpc.admin.getAnalytics.useQuery({ hours });

  if (isLoading) return <Loading />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-1.5">
        {[
          { h: 1, l: "1г" },
          { h: 24, l: "24г" },
          { h: 24 * 7, l: "7д" },
          { h: 24 * 30, l: "30д" },
        ].map(p => (
          <button key={p.h} onClick={() => setHours(p.h)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${hours === p.h ? "bg-purple-600 text-white" : "bg-[#12121a] text-slate-400"}`}>
            {p.l}
          </button>
        ))}
      </div>

      {/* Funnel */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">🎯 Воронка</p>
        <div className="space-y-1.5">
          {[
            { label: "Зареєструвалось", value: data.funnel.registered, color: "bg-blue-500" },
            { label: "Відкрив пак", value: data.funnel.openedPack, color: "bg-purple-500" },
            { label: "Виставив на маркет", value: data.funnel.listedItem, color: "bg-pink-500" },
            { label: "Завершив угоду", value: data.funnel.completedTrade, color: "bg-green-500" },
          ].map((step, i, arr) => {
            const max = arr[0].value || 1;
            const pct = (step.value / max) * 100;
            const conv = i > 0 ? ((step.value / (arr[i - 1].value || 1)) * 100).toFixed(1) : null;
            return (
              <Card key={step.label} className="bg-[#12121a] border-[#1e1e2e] p-2.5 rounded-xl">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{step.label}</span>
                  <span className="text-white font-bold">
                    {step.value} {conv && <span className="text-slate-500 font-normal">({conv}%)</span>}
                  </span>
                </div>
                <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                  <div className={`h-full ${step.color}`} style={{ width: `${pct}%` }} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Revenue */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">💵 Виручка (7д)</p>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Угод" value={data.revenue.transactions} />
          <StatCard label="Об'єм" value={data.revenue.volume.toLocaleString()} accent="text-yellow-400" />
          <StatCard label="Комісії" value={data.revenue.fees.toLocaleString()} accent="text-green-400" />
        </div>
      </div>

      {/* Top events */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">📊 Топ події</p>
        <div className="space-y-1.5">
          {data.topEvents.map((e: any) => (
            <Card key={e.event} className="bg-[#12121a] border-[#1e1e2e] p-2.5 rounded-xl flex items-center justify-between">
              <p className="text-xs text-white font-mono">{e.event}</p>
              <div className="text-right">
                <p className="text-xs font-bold text-white">{e.count}</p>
                <p className="text-[9px] text-slate-500">{e.uniqueUsers} unique</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Errors Tab ─────────────────────────────────────────────────
function ErrorsTab() {
  const { data, isLoading, refetch } = trpc.admin.getErrors.useQuery({ limit: 50 });

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Останні {data?.length ?? 0} помилок</p>
        <Button size="sm" onClick={() => refetch()} className="text-[10px] h-7 bg-[#12121a] rounded-lg">↻ Оновити</Button>
      </div>
      {data?.length === 0 && (
        <Card className="bg-[#12121a] border-[#1e1e2e] p-6 rounded-2xl text-center">
          <p className="text-3xl mb-2">✨</p>
          <p className="text-slate-400 text-sm">Немає помилок!</p>
        </Card>
      )}
      {data?.map((e: any) => (
        <Card key={e.id} className="bg-red-900/10 border-red-500/20 p-3 rounded-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono bg-red-900/30 text-red-300 px-2 py-0.5 rounded">{e.source}</span>
            <span className="text-[9px] text-slate-500">{new Date(e.created_at).toLocaleString("uk-UA")}</span>
          </div>
          {e.endpoint && <p className="text-[10px] text-purple-400 font-mono mb-1">{e.endpoint}</p>}
          <p className="text-xs text-white font-mono break-all">{e.message}</p>
          {e.user_id && <p className="text-[9px] text-slate-500 mt-1">User: {e.user_id}</p>}
        </Card>
      ))}
    </div>
  );
}

// ─── Broadcast Tab ──────────────────────────────────────────────
function BroadcastTab() {
  const [message, setMessage] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const broadcast = trpc.admin.broadcast.useMutation({
    onSuccess: (data) => {
      toast.success(`📢 Розіслано ${data.sent}/${data.total}`, data.failed ? `${data.failed} не доставлено` : "");
      setMessage("");
    },
    onError: (e) => toast.error("Помилка", e.message),
  });

  return (
    <div className="space-y-3">
      <Card className="bg-amber-900/20 border-amber-500/30 p-3 rounded-2xl">
        <p className="text-xs text-amber-300 leading-relaxed">
          ⚠️ Повідомлення піде через @DropCulture_bot всім користувачам. Підтримує HTML: &lt;b&gt;жирний&lt;/b&gt;, &lt;i&gt;курсив&lt;/i&gt;, &lt;a href=""&gt;посилання&lt;/a&gt;
        </p>
      </Card>

      <textarea value={message} onChange={e => setMessage(e.target.value)}
        placeholder="🎉 Нова колекція 'Cyber Punks' уже у грі! Заходь і відкривай..."
        rows={6}
        className="w-full bg-[#12121a] border border-[#1e1e2e] rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 resize-none"
      />

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} className="accent-purple-500" />
        Тільки активним за останні 7 днів
      </label>

      <Button onClick={() => {
        if (!message.trim()) { toast.error("Введи повідомлення"); return; }
        if (!confirm(`Розіслати повідомлення ${onlyActive ? "активним" : "ВСІМ"} користувачам?`)) return;
        broadcast.mutate({ message, onlyActive });
      }} disabled={broadcast.isPending} className="w-full h-12 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold">
        <Send className="w-4 h-4 mr-2" />
        {broadcast.isPending ? "Розсилаю..." : "Розіслати"}
      </Button>
    </div>
  );
}

// ─── Settings Tab ───────────────────────────────────────────────
function SettingsTab() {
  const { data: settings, refetch } = trpc.admin.getSettings.useQuery();
  const setSetting = trpc.admin.setSetting.useMutation({
    onSuccess: () => { refetch(); toast.success("✅ Збережено"); },
    onError: (e) => toast.error("Помилка", e.message),
  });

  const SETTINGS_DEF = [
    { key: "global_pack_discount_pct", label: "Знижка на паки (%)", placeholder: "0", help: "Наприклад 20 = -20% на всі паки" },
    { key: "wheel_cooldown_hours", label: "Cooldown колеса (год)", placeholder: "12", help: "За замовчуванням 12 годин" },
    { key: "daily_pack_cooldown_hours", label: "Cooldown daily паку (год)", placeholder: "20", help: "За замовчуванням 20 годин" },
    { key: "market_commission_pct", label: "Комісія маркету (%)", placeholder: "5", help: "За замовчуванням 5%" },
    { key: "announcement_message", label: "Оголошення на головній", placeholder: "—", help: "HTML підтримується" },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Системні налаштування. Залиш порожнім для дефолту.</p>
      {SETTINGS_DEF.map(s => {
        const current = settings?.[s.key] ?? "";
        return (
          <Card key={s.key} className="bg-[#12121a] border-[#1e1e2e] p-3 rounded-xl">
            <p className="text-xs font-bold text-white mb-1">{s.label}</p>
            <p className="text-[10px] text-slate-500 mb-2">{s.help}</p>
            <div className="flex gap-2">
              <input id={`setting-${s.key}`} defaultValue={current} placeholder={s.placeholder}
                className="flex-1 bg-[#0a0a0f] border border-[#2a2a3e] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500/50" />
              <Button size="sm" onClick={() => {
                const el = document.getElementById(`setting-${s.key}`) as HTMLInputElement;
                setSetting.mutate({ key: s.key, value: el.value });
              }} className="bg-purple-600 hover:bg-purple-700 rounded-lg text-xs">Зберегти</Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────
function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon?: any; accent?: string }) {
  return (
    <Card className="bg-[#12121a] border-[#1e1e2e] p-3 rounded-xl">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-[10px] text-slate-500 uppercase font-bold">{label}</p>
      </div>
      <p className={`text-lg font-bold ${accent ?? "text-white"}`}>{value}</p>
    </Card>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
