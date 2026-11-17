import type { Metadata } from "next";
import { AdminStudio } from "@/components/admin/AdminStudio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Studio — 创作与监控中枢",
  description: "文章发布、动态记录、友链管理、评论互动与访问监控后台",
};

export default function AdminPage() {
  return <AdminStudio />;
}
