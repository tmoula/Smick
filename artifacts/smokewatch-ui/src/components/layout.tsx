import { Link, useLocation } from "wouter";
import { ReactNode } from "react";
import { Terminal, Activity, List, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Simulator", icon: Activity },
    { href: "/log", label: "Detection Log", icon: List },
    { href: "/messages", label: "Messages", icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <nav className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-2 text-primary">
          <Terminal className="h-6 w-6" />
          <span className="font-mono font-bold tracking-tight text-lg">SmokeWatch</span>
        </div>
        <div className="flex flex-row md:flex-col p-2 gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location === item.href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
