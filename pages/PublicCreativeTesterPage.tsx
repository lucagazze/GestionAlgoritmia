import React from 'react';
import CreativeTesterPage from './CreativeTesterPage';

export default function PublicCreativeTesterPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#0a0a0a] font-sans">
      {/* Minimal top bar */}
      <header className="bg-white/80 dark:bg-[#161618]/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/[0.06] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow">
            <span className="text-white text-[11px] font-bold">A</span>
          </div>
          <span className="text-[14px] font-semibold text-zinc-900 dark:text-white">Algoritmia</span>
          <span className="text-zinc-300 dark:text-zinc-700 mx-1">·</span>
          <span className="text-[13px] text-zinc-500 dark:text-zinc-400">Creative Tester</span>
          <span className="ml-auto text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-white/5 px-2 py-1 rounded-md border border-zinc-200 dark:border-white/[0.06]">
            Powered by GPT-4o Vision
          </span>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <CreativeTesterPage />
      </main>

      <footer className="text-center py-8 text-[12px] text-zinc-400 dark:text-zinc-600">
        Algoritmia · Creative Tester — Análisis neuronal de creativos por IA
      </footer>
    </div>
  );
}
