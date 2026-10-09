import type { Metadata } from "next";

import { StudioSkillsPage } from "@/components/studio-skills-page";
import { getRequestSiteLocale } from "@/lib/site-locale-server";
import { studioSkillsMetadata } from "@/lib/studio-page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return studioSkillsMetadata(await getRequestSiteLocale());
}

export default async function SkillsPage() {
  return <StudioSkillsPage locale={await getRequestSiteLocale()} />;
}
