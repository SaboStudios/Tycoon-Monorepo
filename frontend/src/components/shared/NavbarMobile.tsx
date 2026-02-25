"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/", label: "Home" },
  { href: "/play-ai", label: "Play AI" },
  { href: "/game-settings", label: "Game Settings" },
  { href: "/join-room", label: "Join Room" },
];

const NavbarMobile = () => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-0 right-0 z-40 flex justify-center md:hidden">
      <div className="flex w-[90%] max-w-md items-center justify-between rounded-full border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] px-4 py-2 shadow-lg shadow-black/40">
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((prev) => !prev)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--tycoon-bg)] text-[var(--tycoon-text)] hover:text-[var(--tycoon-accent)] transition-colors"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {links.slice(0, 2).map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/" || pathname.startsWith("/(home)")
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-[11px] font-dm-sans font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--tycoon-accent)] text-[#010F10]"
                    : "text-[var(--tycoon-text)]/70 hover:text-[var(--tycoon-accent)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      {open && (
        <div className="absolute bottom-16 left-1/2 w-[90%] max-w-md -translate-x-1/2 rounded-2xl border border-[var(--tycoon-border)] bg-[var(--tycoon-bg)]/98 p-3 shadow-xl shadow-black/60">
          <ul className="flex flex-col gap-1">
            {links.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/" || pathname.startsWith("/(home)")
                  : pathname === link.href ||
                    pathname.startsWith(`${link.href}/`);

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-dm-sans transition-colors ${
                      isActive
                        ? "bg-[var(--tycoon-accent)] text-[#010F10]"
                        : "text-[var(--tycoon-text)]/80 hover:bg-[var(--tycoon-card-bg)] hover:text-[var(--tycoon-accent)]"
                    }`}
                  >
                    <span>{link.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
};

export default NavbarMobile;

