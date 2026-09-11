import * as React from "react";

import { CTAButton, EmailShell, Eyebrow, Footer, StickerStrip, Wordmark } from "@/lib/mailer/components";
import { CANVAS, CARD, cellBg, CREAM, FONT_DISPLAY, FONT_MONO, GOLD, MUTED, TEXT } from "@/lib/mailer/theme";

export interface PlayOutsideLeadEmailProps {
  breakName: string;
  heatTotal: number;
  breakUrl: string;
  downloadUrl: string;
}

export function PlayOutsideLeadEmail({ breakName, heatTotal, breakUrl, downloadUrl }: PlayOutsideLeadEmailProps): React.ReactElement {
  return (
    <EmailShell>
      <Wordmark />
      <tr><td {...cellBg(CANVAS, { padding: "26px 28px 22px" })}>
        <Eyebrow color={GOLD}>OUTSIDE / HEAT REPORT</Eyebrow>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, lineHeight: 1.05, color: CREAM, margin: 0 }}>{breakName}, and the real forecast</h1>
      </td></tr>
      <tr><td {...cellBg(CARD, { padding: "24px 28px" })}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 16, lineHeight: 1.45, color: TEXT, margin: "0 0 18px" }}>You put up a <strong>{heatTotal.toFixed(2)}</strong> heat at {breakName}. Nice work. See what the real ocean is doing next.</p>
        <div style={{ textAlign: "center", padding: "8px 0 22px" }}><CTAButton href={breakUrl}>Check the real forecast</CTAButton></div>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, lineHeight: 1.5, color: TEXT, margin: 0 }}>Want the whole call in your pocket? <a href={downloadUrl} style={{ color: GOLD }}>Get the Quiver app</a>.</p>
        <div style={{ paddingTop: 22 }}><StickerStrip /></div>
      </td></tr>
      <Footer><p style={{ fontFamily: FONT_MONO, fontSize: 10, lineHeight: 1.4, color: MUTED, margin: 0 }}>You asked for this forecast message. Quiver updates are optional; unsubscribe any time.</p></Footer>
    </EmailShell>
  );
}
