"use client";

import React, { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NearWalletConnect } from "@/components/wallet/NearWalletConnect";
import { useAuth } from "@/components/providers/auth-provider";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { NAV_LINKS, isActivePath } from "@/lib/nav-config";

const MOBILE_NAV_PANEL_ID = "mobile-primary-nav";

const NavbarMobile = () => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setOpen(false), []);

  useFocusTrap(panelRef, open, closeMenu);

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center md:hidden">
      <div className="flex w-[90%] max-w-md items-center justify-between rounded-full border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] px-4 py-2 shadow-lg shadow-black/40">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={MOBILE_NAV_PANEL_ID}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((prev) => !prev)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--tycoon-bg)] text-[var(--tycoon-text)] transition-colors hover:text-[var(--tycoon-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tycoon-accent)]"
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {NAV_LINKS.slice(0, 2).map((link) => {
            const isActive = isActivePath(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-[11px] font-dm-sans font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tycoon-accent)] ${
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

      {open ? (
        <div
          ref={panelRef}
          id={MOBILE_NAV_PANEL_ID}
          role="dialog"
          aria-modal="true"
          aria-label="Primary navigation"
          className="absolute bottom-16 left-1/2 w-[90%] max-w-md -translate-x-1/2 rounded-2xl border border-[var(--tycoon-border)] bg-[var(--tycoon-bg)]/98 p-3 shadow-xl shadow-black/60"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = isActivePath(pathname, link.href);

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-dm-sans transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tycoon-accent)] ${
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
          <div className="mt-3 space-y-3 border-t border-[var(--tycoon-border)] pt-3">
            {user ? (
              <div className="flex flex-col gap-2 rounded-xl bg-[var(--tycoon-card-bg)] px-3 py-2">
                <p className="truncate text-xs text-[var(--tycoon-text)]/70 font-dm-sans">{user.email}</p>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    logout();
                  }}
                  className="rounded-full border border-[var(--tycoon-border)] bg-[var(--tycoon-bg)] px-3 py-2 text-xs font-dm-sans font-medium text-[var(--tycoon-text)] transition-colors hover:bg-[var(--tycoon-accent)] hover:text-[#010F10] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tycoon-accent)]"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={closeMenu}
                className="flex items-center justify-center rounded-full bg-[var(--tycoon-accent)] px-3 py-2 text-xs font-dm-sans font-medium text-[#010F10] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tycoon-text)]"
              >
                Login
              </Link>
            )}
            <NearWalletConnect variant="panel" />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NavbarMobile;
