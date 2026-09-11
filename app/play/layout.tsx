import { Press_Start_2P } from "next/font/google";
import type { ReactElement, ReactNode } from "react";

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-play-pixel",
});

interface PlayLayoutProps {
  children: ReactNode;
}

export default function PlayLayout({ children }: PlayLayoutProps): ReactElement {
  return <div className={`${pixelFont.variable} [font-family:var(--font-play-pixel)]`}>{children}</div>;
}
