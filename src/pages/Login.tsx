// This page is not used — auth happens automatically via Telegram initData on Home.tsx
// Kept as fallback for non-Telegram browser access

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center px-6">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <span className="text-4xl">💎</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">DropCulture</h1>
        <p className="text-slate-400 mb-6">Відкрий цю сторінку у Telegram</p>
        <a
          href="https://t.me/YourBotUsername"
          className="inline-block bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-3 px-8 rounded-xl"
        >
          Відкрити в Telegram
        </a>
      </div>
    </div>
  );
}
