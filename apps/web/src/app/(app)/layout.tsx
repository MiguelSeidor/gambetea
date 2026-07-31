import "../app.css";
import AppProvider from "@/components/AppProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
