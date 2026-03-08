import { LayoutDashboard, Package, Zap, BarChart3, Play } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useRunWorker } from "@/hooks/use-deals";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Products", url: "/products", icon: Package },
  { title: "Deals", url: "/deals", icon: Zap },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const runWorker = useRunWorker();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleRunWorker = async (name: string, label: string) => {
    try {
      toast.info(`Running ${label}...`);
      const result = await runWorker.mutateAsync(name);
      toast.success(`${label} completed`, { description: JSON.stringify(result).slice(0, 100) });
    } catch {
      toast.error(`${label} failed`);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center glow-green shrink-0">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight">DealHunter AI</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-muted/50"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && (
          <SidebarGroup>
            <SidebarGroupLabel>Workers</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="space-y-1 px-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => handleRunWorker("discover-products", "Product Discovery")}
                  disabled={runWorker.isPending}
                >
                  <Play className="h-3 w-3 mr-2" /> Discover Products
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => handleRunWorker("check-prices", "Price Check")}
                  disabled={runWorker.isPending}
                >
                  <Play className="h-3 w-3 mr-2" /> Check Prices
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => handleRunWorker("detect-deals", "Deal Detection")}
                  disabled={runWorker.isPending}
                >
                  <Play className="h-3 w-3 mr-2" /> Detect Deals
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => handleRunWorker("process-deals", "AI Processing")}
                  disabled={runWorker.isPending}
                >
                  <Play className="h-3 w-3 mr-2" /> Process Deals (AI)
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      {!collapsed && (
        <SidebarFooter className="p-4">
          <p className="text-xs text-muted-foreground">AI pipeline runs every 20 min</p>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
