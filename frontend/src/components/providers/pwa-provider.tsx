"use client";

import { Download, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PWA_SW_SCOPE, PWA_SW_URL } from "@/lib/pwa/constants";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function PwaBanner({
  action,
  actionLabel,
  className,
  description,
  icon: Icon,
  title,
}: {
  action: () => void | Promise<void>;
  actionLabel: string;
  className?: string;
  description: string;
  icon: typeof Download;
  title: string;
}) {
  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-2xl flex-col gap-4 rounded-2xl border border-[#00F0FF]/25 bg-[#07181B] p-4 text-[#F0F7F7] shadow-[0_20px_45px_rgba(0,0,0,0.35)] backdrop-blur",
        "sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-[#00F0FF]/15 p-2 text-[#00F0FF]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-orbitron text-sm font-semibold uppercase tracking-[0.18em]">
            {title}
          </p>
          <p className="mt-1 text-sm text-[#F0F7F7]/75">{description}</p>
        </div>
      </div>
      <Button
        type="button"
        onClick={() => void action()}
        className="bg-[#00F0FF] font-orbitron text-xs font-semibold uppercase tracking-[0.16em] text-[#010F10] hover:bg-[#86F8FF]"
      >
        {actionLabel}
      </Button>
    </div>
  );
}

export function PWAProvider() {
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    let isRefreshing = false;
    let updateIntervalId: number | undefined;

    const handleControllerChange = () => {
      if (isRefreshing) {
        return;
      }

      isRefreshing = true;
      window.location.reload();
    };

    const handleWaitingState = (nextRegistration: ServiceWorkerRegistration) => {
      setRegistration(nextRegistration);
      setIsUpdateReady(Boolean(nextRegistration.waiting));
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    void navigator.serviceWorker
      .register(PWA_SW_URL, { scope: PWA_SW_SCOPE })
      .then((nextRegistration) => {
        handleWaitingState(nextRegistration);

        updateIntervalId = window.setInterval(() => {
          void nextRegistration.update();
        }, 60 * 60 * 1000);

        nextRegistration.addEventListener("updatefound", () => {
          const installingWorker = nextRegistration.installing;

          if (!installingWorker) {
            return;
          }

          installingWorker.addEventListener("statechange", () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setRegistration(nextRegistration);
              setIsUpdateReady(true);
            }
          });
        });
      })
      .catch(() => {
        setRegistration(null);
        setIsUpdateReady(false);
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);

      if (updateIntervalId) {
        window.clearInterval(updateIntervalId);
      }
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    setDeferredInstallPrompt(null);
  };

  const handleApplyUpdate = () => {
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <>
      {isUpdateReady ? (
        <PwaBanner
          action={handleApplyUpdate}
          actionLabel="Update now"
          description="A new shell build is ready. Refresh to swap in the updated service worker and shell assets."
          icon={RefreshCcw}
          title="Update Available"
        />
      ) : null}

      {!isUpdateReady && deferredInstallPrompt ? (
        <PwaBanner
          action={handleInstall}
          actionLabel="Install app"
          className="bottom-28 sm:bottom-6"
          description="Install Tycoon on Android Chrome for a standalone launcher and faster shell startup."
          icon={Download}
          title="Install Tycoon"
        />
      ) : null}
    </>
  );
}
