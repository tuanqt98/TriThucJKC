import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Tri Thức JKC",
  description: "Cổng tri thức nội bộ JKC — môi trường Sprint 0",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
