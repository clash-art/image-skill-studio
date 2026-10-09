import type { Metadata } from "next";

import { ClashHomePage } from "@/components/clash-home-page";
import { clashHomeMetadata } from "@/lib/studio-page-metadata";

export const metadata: Metadata = clashHomeMetadata("zh");

export default function ZhHomePage() {
  return <ClashHomePage locale="zh" />;
}
