"use client";

export function NavbarErrorFallback() {
  return (
    <header
      className="sticky top-0 z-30 hidden h-16 w-full border-b border-[var(--tycoon-border)] bg-[#010F10]/95 backdrop-blur-md md:block"
      role="banner"
      aria-label="Site navigation (error state)"
    >
      <div className="mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <a
          href="/"
          className="font-orbitron text-sm font-semibold tracking-[0.18em] uppercase text-[var(--tycoon-text)]"
        >
          Tycoon
        </a>
      </div>
    </header>
  );
}
