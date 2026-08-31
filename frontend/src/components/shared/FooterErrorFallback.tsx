export function FooterErrorFallback() {
  return (
    <footer
      className="w-full px-4 pb-8 sm:px-6 lg:px-8"
      role="contentinfo"
      aria-label="Site footer (error state)"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-4 rounded-2xl bg-[#0B191A] p-5">
        <p className="text-[#F0F7F7] text-[12px]">
          &copy; {new Date().getFullYear()} Tycoon
        </p>
      </div>
    </footer>
  );
}
