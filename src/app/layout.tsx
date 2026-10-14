import type { Metadata } from "next";
import "./globals.css";
import "./shop.css";
import "../components/student/student.css";

export const metadata: Metadata = {
  title: "Printify — Queue-free campus printing",
  description: "Upload your document and collect your prints without the queue.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
