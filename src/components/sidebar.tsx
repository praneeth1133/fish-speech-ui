"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Mic,
  Library,
  Clock,
  Key,
  Settings,
  Activity,
  Fish,
  Sun,
  Moon,
  Menu,
  X,
  Globe2,
} from "lucide-react";
import { useQueueStore } from "@/lib/queue-store";
import { useBackendStatus } from "@/lib/use-backend-status";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "Text to Speech", icon: Mic },
  { href: "/omnivoice", label: "OmniVoice (600+)", icon: Globe2 },
  { href: "/voices", label: "Voice Library", icon: Library },
  { href: "/history", label: "History", icon: Clock },
  { href: "/api-keys", label: "API Keys", icon: Key },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const queueCount = useQueueStore((s) =>
    s.jobs.filter((j) => j.status === "pending" || j.status === "processing").length
  );
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const backendStatus = useBackendStatus();

  useEffect(() => setMounted(true), []);
  // Close mobile menu on route change
  useEffect(() => setMobileOpen(false), [pathname]);

  const isDark = resolvedTheme === "dark";

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent">
            <Fish className="h-4 w-4 text-sidebar-accent-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-sidebar-foreground">Fish Speech</h1>
            <p className="text-[11px] text-muted-foreground">S2 Pro</p>
          </div>
        </div>
        {/* Close button - mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-sidebar-accent/50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.href === "/" && queueCount > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {queueCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle + Status */}
      <div className="border-t border-border px-3 py-3 space-y-2">
        {mounted && (
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
        )}
        <div
          className="flex items-center gap-2 px-3 text-[11px] text-muted-foreground"
          title={
            backendStatus === "connected"
              ? "Fish Speech backend is reachable"
              : backendStatus === "disconnected"
                ? "Backend is offline — start your local Fish Speech server + ngrok tunnel"
                : "Checking backend status…"
          }
        >
          <Activity className="h-3 w-3" />
          <span>
            {backendStatus === "connected"
              ? "Server Online"
              : backendStatus === "disconnected"
                ? "Server Offline"
                : "Checking…"}
          </span>
          <span className="ml-auto relative flex h-2 w-2">
            {backendStatus === "connected" && (
              <>
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </>
            )}
            {backendStatus === "disconnected" && (
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            )}
            {backendStatus === "checking" && (
              <span className="relative inline-flex h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" />
            )}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-sidebar border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Fish className="h-4 w-4 text-sidebar-accent-foreground" />
            <span className="text-sm font-semibold text-sidebar-foreground">Fish Speech</span>
          </div>
        </div>
        {/* Mobile theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-2 rounded-lg text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>
        )}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - desktop: always visible, mobile: slide-in drawer */}
      <div
        className={cn(
          "flex flex-col bg-sidebar border-r border-border flex-shrink-0 h-full",
          // Desktop
          "hidden lg:flex lg:w-60",
          // Mobile drawer
          mobileOpen && "!flex fixed inset-y-0 left-0 z-50 w-72 shadow-2xl"
        )}
      >
        {sidebarContent}
      </div>
    </>
  );
}
