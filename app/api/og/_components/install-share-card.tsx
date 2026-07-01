import type { ReactElement } from "react";
import { toString as qrCodeToString } from "qrcode";

interface ShareCardMockupsProps {
  baseUrl: string;
  compact?: boolean;
}

interface StoreButtonsProps {
  compact?: boolean;
}

interface QrBlockProps {
  qrImageSrc: string;
  logoUrl: string;
  compact?: boolean;
}

export interface InstallShareCardProps {
  baseUrl: string;
  qrValue: string;
  qrImageSrc: string;
  title: string;
  subtitle: string;
  footer?: string;
  compact?: boolean;
}

export const SHARE_CARD_COLORS = {
  ink: "#11100D",
  muted: "#667085",
  navy: "#252D6B",
  orange: "#F78E42",
  paper: "#FFFFFF",
  rule: "#E7EAF1",
} as const;

function appScreenshotUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path}?v=home-best-v3`;
}

export async function createQrCodeDataUri(value: string): Promise<string> {
  const svg = await qrCodeToString(value, {
    type: "svg",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "H",
    color: {
      dark: `${SHARE_CARD_COLORS.navy}ff`,
      light: "#FFFFFFFF",
    },
  });

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function AppIcon({ logoUrl, compact = false }: { logoUrl: string; compact?: boolean }): ReactElement {
  const size = compact ? 64 : 126;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: compact ? 18 : 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        boxShadow: "0 12px 30px rgba(37,45,107,0.2)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt="Quiver"
        width={size}
        height={size}
        style={{ width: size, height: size, display: "flex" }}
      />
    </div>
  );
}

function ShareCardMockups({ baseUrl, compact = false }: ShareCardMockupsProps): ReactElement {
  const images = [
    {
      src: appScreenshotUrl(
        baseUrl,
        compact
          ? "/images/app-screenshots/share-cards/explore-map-side-phone-compact.jpg"
          : "/images/app-screenshots/share-cards/explore-map-side-phone.jpg",
      ),
      rotate: "-5deg",
      translateX: compact ? -118 : -230,
      translateY: compact ? 8 : 30,
      scale: compact ? 0.86 : 0.9,
    },
    {
      src: appScreenshotUrl(
        baseUrl,
        compact
          ? "/images/app-screenshots/share-cards/explore-tabs-side-phone-compact.jpg"
          : "/images/app-screenshots/share-cards/explore-tabs-side-phone.jpg",
      ),
      rotate: "5deg",
      translateX: compact ? 118 : 230,
      translateY: compact ? 8 : 30,
      scale: compact ? 0.86 : 0.9,
    },
    {
      src: appScreenshotUrl(
        baseUrl,
        compact
          ? "/images/app-screenshots/share-cards/surf-call-center-phone-compact.jpg"
          : "/images/app-screenshots/share-cards/surf-call-center-phone.jpg",
      ),
      rotate: "0deg",
      translateX: 0,
      translateY: compact ? -4 : -12,
      scale: compact ? 1.06 : 1.08,
    },
  ];
  const width = compact ? 390 : 760;
  const height = compact ? 285 : 570;
  const phoneWidth = compact ? 124 : 250;
  const phoneHeight = compact ? 270 : 544;
  const phoneBorder = compact ? 4 : 8;
  const phoneRadius = compact ? 18 : 36;

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginTop: compact ? 14 : 42,
        marginBottom: compact ? 10 : 34,
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: compact ? 0 : 6,
          width: compact ? 300 : 600,
          height: compact ? 46 : 92,
          borderRadius: "50%",
          background: "rgba(37,45,107,0.12)",
          display: "flex",
        }}
      />
      {images.map((image) => (
        <div
          key={image.src}
          style={{
            position: "absolute",
            transform: `translate(${image.translateX}px, ${image.translateY}px) rotate(${image.rotate}) scale(${image.scale})`,
            display: "flex",
          }}
        >
          <div
            style={{
              width: phoneWidth + phoneBorder * 2,
              height: phoneHeight + phoneBorder * 2,
              borderRadius: phoneRadius,
              background: "#FFFFFF",
              padding: phoneBorder,
              boxShadow: compact
                ? "0 14px 32px rgba(17,16,13,0.18)"
                : "0 30px 80px rgba(17,16,13,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Satori tiles CSS background images; render the screen as a sized
                <img> with objectFit cover so it never repeats. Rotation lives on
                the wrapper above, not on the <img>, to avoid Satori's
                rotated-image slicing. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt=""
              width={phoneWidth}
              height={phoneHeight}
              style={{
                width: phoneWidth,
                height: phoneHeight,
                borderRadius: phoneRadius - phoneBorder,
                objectFit: "cover",
                display: "flex",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function QrBlock({ qrImageSrc, logoUrl, compact = false }: QrBlockProps): ReactElement {
  const boxSize = compact ? 226 : 430;
  const qrSize = compact ? 184 : 304;
  const iconSize = compact ? 22 : 78;

  return (
    <div
      style={{
        width: boxSize,
        height: boxSize,
        borderRadius: compact ? 24 : 36,
        background: "#FFFFFF",
        border: "2px solid #E7EAF1",
        boxShadow: compact
          ? "0 14px 30px rgba(17,16,13,0.1)"
          : "0 24px 60px rgba(17,16,13,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrImageSrc}
        alt=""
        width={qrSize}
        height={qrSize}
        style={{ width: qrSize, height: qrSize, display: "flex" }}
      />
      <div
        style={{
          position: "absolute",
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize / 2,
          background: "#FFFFFF",
          border: compact ? "5px solid #FFFFFF" : "8px solid #FFFFFF",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 20px rgba(37,45,107,0.18)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          width={iconSize}
          height={iconSize}
          style={{ width: iconSize, height: iconSize, display: "flex" }}
        />
      </div>
    </div>
  );
}

function StoreButtons({ compact = false }: StoreButtonsProps): ReactElement {
  const height = compact ? 50 : 78;
  const width = compact ? 140 : 430;
  const fontSize = compact ? 17 : 28;
  const iconSize = compact ? 18 : 32;

  const buttons = compact
    ? [
        { icon: "●", label: "App Store" },
        { icon: "▶", label: "Android beta" },
      ]
    : [
        { icon: "●", label: "Download on the App Store" },
        { icon: "▶", label: "Get Android access" },
      ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 14 : 24,
        marginTop: compact ? 16 : 28,
      }}
    >
      {buttons.map((button) => (
        <div
          key={button.label}
          style={{
            width,
            height,
            borderRadius: compact ? 12 : 16,
            background: "#252D6B",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: compact ? 10 : 16,
            fontSize,
            fontWeight: 800,
            boxShadow: "0 8px 20px rgba(37,45,107,0.18)",
          }}
        >
          <span style={{ fontSize: iconSize, display: "flex" }}>{button.icon}</span>
          <span style={{ display: "flex" }}>{button.label}</span>
        </div>
      ))}
    </div>
  );
}

export function PortraitInstallShareCard({
  baseUrl,
  qrImageSrc,
  title,
  subtitle,
  footer = "Free surf forecasts and session tracking by Quiver",
}: InstallShareCardProps): ReactElement {
  const logoUrl = `${baseUrl}/quiver-app-icon-128.png`;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: SHARE_CARD_COLORS.paper,
        color: SHARE_CARD_COLORS.ink,
        fontFamily: "SpaceGrotesk, system-ui, sans-serif",
        padding: "86px 86px 60px",
      }}
    >
      <AppIcon logoUrl={logoUrl} />
      <div
        style={{
          display: "flex",
          marginTop: 34,
          fontSize: 64,
          fontWeight: 900,
          color: SHARE_CARD_COLORS.ink,
          textAlign: "center",
          lineHeight: 1.04,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          maxWidth: 850,
          marginTop: 20,
          fontSize: 33,
          fontWeight: 700,
          color: SHARE_CARD_COLORS.muted,
          textAlign: "center",
          lineHeight: 1.35,
        }}
      >
        {subtitle}
      </div>

      <ShareCardMockups baseUrl={baseUrl} />
      <QrBlock qrImageSrc={qrImageSrc} logoUrl={logoUrl} />

      <div
        style={{
          display: "flex",
          marginTop: 44,
          fontSize: 28,
          fontWeight: 900,
          color: SHARE_CARD_COLORS.ink,
          textAlign: "center",
        }}
      >
        Point your phone camera at the code
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 8,
          fontSize: 23,
          fontWeight: 700,
          color: SHARE_CARD_COLORS.muted,
          textAlign: "center",
        }}
      >
        It opens Quiver automatically on iOS or Android.
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          gap: 20,
          marginTop: 42,
        }}
      >
        <div style={{ height: 2, flex: 1, background: SHARE_CARD_COLORS.rule, display: "flex" }} />
        <div
          style={{
            display: "flex",
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 0,
            color: "#A0A7B5",
          }}
        >
          ON YOUR PHONE? TAP BELOW
        </div>
        <div style={{ height: 2, flex: 1, background: SHARE_CARD_COLORS.rule, display: "flex" }} />
      </div>

      <StoreButtons />
      <div
        style={{
          display: "flex",
          marginTop: 36,
          fontSize: 20,
          fontWeight: 700,
          color: "#A0A7B5",
          textAlign: "center",
        }}
      >
        {footer} · quiversurf.app
      </div>
    </div>
  );
}

export function LandscapeInstallShareCard({
  baseUrl,
  qrImageSrc,
  title,
  subtitle,
  footer = "Free surf forecasts and session tracking by Quiver",
}: InstallShareCardProps): ReactElement {
  const logoUrl = `${baseUrl}/quiver-app-icon-128.png`;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        background: SHARE_CARD_COLORS.paper,
        color: SHARE_CARD_COLORS.ink,
        fontFamily: "SpaceGrotesk, system-ui, sans-serif",
        padding: "50px 58px",
        gap: 38,
      }}
    >
      <div
        style={{
          width: 390,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <AppIcon logoUrl={logoUrl} compact />
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 52,
            fontWeight: 900,
            color: SHARE_CARD_COLORS.ink,
            lineHeight: 1.02,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontSize: 24,
            fontWeight: 700,
            color: SHARE_CARD_COLORS.muted,
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontSize: 17,
            fontWeight: 800,
            color: "#A0A7B5",
          }}
        >
          {footer} · quiversurf.app
        </div>
      </div>

      <ShareCardMockups baseUrl={baseUrl} compact />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <QrBlock qrImageSrc={qrImageSrc} logoUrl={logoUrl} compact />
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 21,
            fontWeight: 900,
            color: SHARE_CARD_COLORS.ink,
            textAlign: "center",
          }}
        >
          Point your phone camera at the code
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 5,
            fontSize: 16,
            fontWeight: 700,
            color: SHARE_CARD_COLORS.muted,
            textAlign: "center",
          }}
        >
          Opens Quiver automatically.
        </div>
        <StoreButtons compact />
      </div>
    </div>
  );
}
