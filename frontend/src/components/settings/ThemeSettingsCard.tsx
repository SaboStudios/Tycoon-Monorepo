"use client";

import { Monitor, MoonStar, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/components/providers/theme-provider";
import { getChartPalette } from "@/lib/theme";

export function ThemeSettingsCard() {
  const { clearThemePreference, preference, resolvedTheme, setThemePreference } = useTheme();
  const chartPalette = getChartPalette(resolvedTheme);
  const isDarkModeEnabled = resolvedTheme === "dark";

  return (
    <Card className="border-cyan-200/70 bg-white/95 shadow-sm dark:border-cyan-900/40 dark:bg-neutral-950/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          Appearance
        </CardTitle>
        <CardDescription>
          Starts from your system preference, then keeps your manual override on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200/80 px-4 py-3 dark:border-neutral-800">
          <div className="space-y-1">
            <Label htmlFor="dark-mode-toggle" className="text-base">
              Dark mode
            </Label>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Current source: {preference === "system" ? "System preference" : "Manual override"}
            </p>
          </div>
          <Switch
            id="dark-mode-toggle"
            checked={isDarkModeEnabled}
            onCheckedChange={(checked) => setThemePreference(checked ? "dark" : "light")}
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div className="flex items-start gap-3">
            <Monitor className="mt-0.5 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Follow system theme
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Reset to OS preference and keep it synced when your device theme changes.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearThemePreference}
            disabled={preference === "system"}
          >
            Use System
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-neutral-200/80 p-4 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <MoonStar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Chart contrast preview
            </p>
          </div>
          <div
            className="rounded-lg border p-3"
            style={{
              backgroundColor: chartPalette.background,
              borderColor: chartPalette.grid,
              color: chartPalette.foreground,
            }}
          >
            <div className="mb-3 flex h-24 items-end gap-2 rounded-md px-2 pb-2">
              {chartPalette.series.map((color, index) => (
                <div
                  key={color}
                  className="flex-1 rounded-t-md"
                  style={{
                    backgroundColor: color,
                    height: `${40 + index * 12}px`,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs">
              {chartPalette.series.map((color, index) => (
                <span key={color} className="inline-flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  Series {index + 1}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Logout behavior: theme preference stays in local storage on this browser until you
            change it or reset to system.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
