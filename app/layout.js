import "./globals.css";

export const metadata = {
  title: "솜씨 · 팀을 꾸리는 첫 단계",
  description:
    "아이디어만 있으면, AI가 필요한 역할을 짚고 딱 맞는 사람을 골라드려요.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
