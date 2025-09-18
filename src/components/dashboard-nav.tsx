
"use client"
import Link from "next/link"
import * as React from "react"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Banknote,
  ClipboardList,
  Settings,
  GraduationCap,
  FileText,
  Users2
} from "lucide-react"
import { getSettings } from "@/lib/data"
import type { SchoolSettings, User } from "@/lib/types"
import { getSession } from "@/lib/session"
import { useSession } from "@/hooks/use-session"

import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

const allMenuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ['admin', 'accountant', 'exam'] },
  { href: "/dashboard/classes", label: "Classes", icon: BookOpen, roles: ['admin', 'exam'] },
  { href: "/dashboard/students", label: "Students", icon: Users, roles: ['admin', 'exam'] },
  { href: "/dashboard/accounting", label: "Accounting", icon: Banknote, roles: ['admin', 'accountant'] },
  { href: "/dashboard/exams", label: "Exams", icon: FileText, roles: ['admin', 'exam'] },
  { href: "/dashboard/results", label: "Results", icon: ClipboardList, roles: ['admin', 'exam'] },
  { href: "/dashboard/users", label: "Users", icon: Users2, roles: ['admin'] },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, roles: ['admin'] },
]

export function DashboardNav() {
  const pathname = usePathname();
  const [settings, setSettings] = React.useState<SchoolSettings | null>(null);
  const { session } = useSession();
  
  React.useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const userRole = session?.role;

  const menuItems = React.useMemo(() => {
    if (!userRole) return [];
    return allMenuItems.filter(item => item.roles.includes(userRole));
  }, [userRole]);


  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <GraduationCap className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">{settings?.schoolName || 'Bluebells ERP'}</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </>
  )
}
