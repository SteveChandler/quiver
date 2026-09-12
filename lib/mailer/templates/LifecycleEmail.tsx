import * as React from "react";
import { EmailShell, Wordmark, CTAButton, Eyebrow, Footer, PaperPanel, Sticker, StickerStrip } from "@/lib/mailer/components";
import { CARD, CREAM, PAPER_INK, FONT_BODY, FONT_DISPLAY, GOLD, MUTED, STICKER_ROTATIONS, cellBg } from "@/lib/mailer/theme";
import type { QuiverStickerKey } from "@/lib/ui/quiver-sticker-assets";

interface LifecycleEmailProps {
  headline: string;
  paragraphs: readonly string[];
  ctaLabel: string;
  ctaHref: string;
  unsubscribeUrl: string;
  postalAddress: string;
  sticker: QuiverStickerKey;
  eyebrow: string;
  checklist: boolean;
}

export function LifecycleEmail(props: LifecycleEmailProps): React.ReactElement {
  return <EmailShell>
    <Wordmark />
    <tr><td {...cellBg(CARD, { padding: "24px 24px 20px", overflowWrap: "anywhere" })}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
        <tbody><tr>
          <td style={{ verticalAlign: "middle", paddingRight: 16 }}><Eyebrow color={GOLD}>{props.eyebrow}</Eyebrow></td>
          <td width={96} align="right"><Sticker sticker={props.sticker} width={88} rotation={STICKER_ROTATIONS.hard} /></td>
        </tr></tbody>
      </table>
      <h1 style={{ fontFamily: FONT_DISPLAY, color: CREAM, fontSize: 32, lineHeight: 1.12, margin: "20px 0 0" }}>{props.headline}</h1>
    </td></tr>
    <tr><td {...cellBg(CARD, { padding: "0 24px 22px", overflowWrap: "anywhere" })}>
      <PaperPanel padding="22px 20px">
        {props.checklist ? <ol style={{ color: PAPER_INK, fontFamily: FONT_BODY, fontSize: 16, lineHeight: 1.55, paddingLeft: 22, margin: 0 }}>
          {props.paragraphs.map((paragraph, index) => <li key={paragraph} style={{ paddingLeft: 4, marginBottom: index === props.paragraphs.length - 1 ? 0 : 16 }}>{paragraph}</li>)}
        </ol> : props.paragraphs.map((paragraph, index) => <p key={paragraph} style={{ color: PAPER_INK, fontFamily: FONT_BODY, fontSize: 16, lineHeight: 1.55, margin: index === props.paragraphs.length - 1 ? 0 : "0 0 16px" }}>{paragraph}</p>)}
      </PaperPanel>
      <div style={{ margin: "24px 0 20px", textAlign: "center" }}><CTAButton href={props.ctaHref}>{props.ctaLabel}</CTAButton></div>
      <p style={{ fontFamily: FONT_BODY, color: MUTED, fontSize: 14, textAlign: "center", margin: "0 0 16px" }}>— Steven, founder of Quiver</p>
      <StickerStrip />
    </td></tr>
    <Footer>
      <span style={{ display: "block", fontFamily: FONT_BODY, fontSize: 12, lineHeight: 1.5, color: CREAM }}>{props.postalAddress}</span>
      <a href={props.unsubscribeUrl} style={{ fontFamily: FONT_BODY, fontSize: 13, color: CREAM, textDecoration: "underline", display: "inline-block", padding: "10px 12px" }}>Unsubscribe</a>
    </Footer>
  </EmailShell>;
}
