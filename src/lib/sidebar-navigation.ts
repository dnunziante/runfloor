import type { AppRole } from "./auth/viewer";

export function getSidebarNavigation(role: AppRole) {
  const administrator = role === "platform_owner" || role === "tenant_admin";
  const owner = role === "platform_owner";
  return [
    { id: "help", label: "Help & Support", icon: "BookOpen", items: [
      { href: "/help", label: "Help Center", icon: "BookOpen" },
      ...(owner ? [{ href: "/admin/opal", label: "Opal AI Assistant", icon: "Bot" }] : []),
    ] },
    { id: "billing", label: "Billing & Usage", icon: "Boxes", items: [
      { href: "/billing", label: "Subscription & Billing", icon: "Settings" },
      { href: "/ai-usage", label: "AI Usage & Credits", icon: "Boxes" },
      ...(owner ? [{ href: "/admin/ai-billing", label: "AI Billing Admin", icon: "Boxes" }] : []),
    ] },
    ...([{ id: "administration", label: "Administration", icon: "Settings", items: [
      { href: administrator ? "/admin/settings" : "/admin/settings/roles", label: "Settings", icon: "Wrench" },
      ...(administrator ? [{ href: "/admin", label: "Platform Administration", icon: "Settings" }] : []),
    ] }]),
  ];
}

export function activeSidebarItem(pathname: string, groups: ReturnType<typeof getSidebarNavigation>) {
  return groups.flatMap(group => group.items).filter(item =>
    pathname === item.href || pathname.startsWith(`${item.href}/`)
  ).sort((a, b) => b.href.length - a.href.length)[0];
}
