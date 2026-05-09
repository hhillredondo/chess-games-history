import ThemeSwitcher from "../ThemeSwitcher/ThemeSwitcher.client";

export default function Header() {
  return (
    <header className="flex w-full max-w-none items-center gap-3 border-b-2 border-solid border-[var(--foreground)] px-4 py-5 sm:gap-6 sm:px-8 sm:py-6">
      <div className="min-w-0 shrink-0">
        <ThemeSwitcher />
      </div>
      <div className="min-w-0 flex-1 text-center text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
      Chess Playstyle Analyser
      </div>
      <div
        className="min-w-[9.5rem] shrink-0 sm:min-w-[min(12rem,100%)]"
        aria-hidden
      />
    </header>
  );
}
