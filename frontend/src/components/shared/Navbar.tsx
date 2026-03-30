"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/providers/auth-provider";
import { NearWalletConnect } from "@/components/wallet/NearWalletConnect";
import { NAV_LINKS, isActivePath } from "@/lib/nav-config";

const Navbar = () => {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 hidden h-16 w-full border-b border-[var(--tycoon-border)] bg-[#010F10]/95 backdrop-blur-md md:block">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tycoon-accent)]"
        >
          <div className="relative h-8 w-8">
            <Image
              src="/logo.png"
              alt="Tycoon"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="font-orbitron text-sm font-semibold tracking-[0.18em] uppercase text-[var(--tycoon-text)]">
            Tycoon
          </span>
        </Link>

        <nav
          className="flex items-center gap-3 rounded-full border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] px-3 py-1.5"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => {
            const isActive = isActivePath(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-full px-4 py-1.5 text-xs font-dm-sans font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tycoon-accent)] ${
                  isActive
                    ? "bg-[var(--tycoon-accent)] text-[#010F10]"
                    : "text-[var(--tycoon-text)]/70 hover:text-[var(--tycoon-accent)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/settings"
            className={`relative rounded-full px-3 py-1.5 text-xs font-dm-sans font-medium transition-colors duration-200 flex items-center gap-1 ${
              pathname === "/settings" || pathname.startsWith("/settings/")
                ? "bg-[var(--tycoon-accent)] text-[#010F10]"
                : "text-[var(--tycoon-text)]/70 hover:text-[var(--tycoon-accent)]"
            }`}
          >
            <Settings className="h-4 w-4" />
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <NearWalletConnect />
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--tycoon-text)]/70 font-dm-sans">
                {user.email}
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] px-4 py-1.5 text-xs font-dm-sans font-medium text-[var(--tycoon-text)] transition-colors hover:bg-[var(--tycoon-accent)] hover:text-[#010F10] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tycoon-accent)]"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-[var(--tycoon-accent)] px-4 py-1.5 text-xs font-dm-sans font-medium text-[#010F10] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tycoon-text)]"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
