import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui";
export const metadata = { title: "Gym admin", robots: { index: false } };
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen"><Sidebar /><main className="px-4 py-6 lg:ml-60 lg:px-8">{children}</main><Toaster /></div>;
}
