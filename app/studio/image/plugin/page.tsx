import type { Metadata } from "next";

import { StudioPluginPage } from "@/components/studio-plugin-page";
import { getRequestSiteLocale } from "@/lib/site-locale-server";
import { studioPluginMetadata } from "@/lib/studio-page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return studioPluginMetadata(await getRequestSiteLocale());
}

export default async function PluginPage() {
  return <StudioPluginPage locale={await getRequestSiteLocale()} />;
}
