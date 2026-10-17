"use client";

import { usePathname } from "next/navigation";
import WebflowController from "./WebflowController";
import ScrollRevealController from "./ScrollRevealController";
import Navbar from "./components/Navbar";

export default function SiteChrome() {
  const pathname = usePathname();
  const isStudioRoute = pathname === "/studio" || pathname.startsWith("/studio/");

  if (isStudioRoute) return null;

  return (
    <>
      <WebflowController />
      <ScrollRevealController />
      <Navbar />
    </>
  );
}
