"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Settings,
  Globe,
  MessageSquare,
  Cpu,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

const links = [
  {
    label: "Dashboard",
    href: "/",
    icon: <LayoutDashboard className="text-neutral-300 h-5 w-5 flex-shrink-0" />,
  },
  {
    label: "Users",
    href: "/users",
    icon: <Users className="text-neutral-300 h-5 w-5 flex-shrink-0" />,
  },
  {
    label: "Firmware",
    href: "/firmware",
    icon: <Cpu className="text-neutral-300 h-5 w-5 flex-shrink-0" />,
  },
  {
    label: "Website",
    href: "/website",
    icon: <Globe className="text-neutral-300 h-5 w-5 flex-shrink-0" />,
  },
  {
    label: "SMS",
    href: "/sms",
    icon: <MessageSquare className="text-neutral-300 h-5 w-5 flex-shrink-0" />,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <Settings className="text-neutral-300 h-5 w-5 flex-shrink-0" />,
  },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className={cn("flex flex-col md:flex-row bg-neutral-950 w-full h-screen")}>
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-1">
              {links.map((link, idx) => (
                <SidebarLink
                  key={idx}
                  link={link}
                  active={pathname === link.href}
                />
              ))}
            </div>
          </div>
          {/* Logout removed - no auth in this dashboard */}
        </SidebarBody>
      </Sidebar>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}

export const Logo = () => {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm text-white py-1 relative z-20"
    >
      <div className="h-6 w-6 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
        <span className="text-white font-bold text-xs">C</span>
      </div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-semibold text-white whitespace-pre"
      >
        CalcAI Admin
      </motion.span>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm text-white py-1 relative z-20"
    >
      <div className="h-6 w-6 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
        <span className="text-white font-bold text-xs">C</span>
      </div>
    </Link>
  );
};

