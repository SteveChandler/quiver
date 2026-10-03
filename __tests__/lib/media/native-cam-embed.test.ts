import { buildCamEmbed } from "@/lib/media/cam-embed";
import { toNativeCamEmbed } from "@/lib/media/native-cam-embed";

const embed = (url: string | null | undefined) => toNativeCamEmbed(buildCamEmbed(url));

describe("toNativeCamEmbed", () => {
  it("maps youtube watch?v= URLs to an https embed", () => {
    expect(embed("https://www.youtube.com/watch?v=abc123")).toEqual({
      kind: "iframe",
      src: "https://www.youtube.com/embed/abc123?rel=0&autoplay=1&mute=1",
      provider: "youtube",
      title: "Live Cam",
    });
  });

  it("maps youtu.be short links to an https embed", () => {
    expect(embed("https://youtu.be/xyz789")).toEqual({
      kind: "iframe",
      src: "https://www.youtube.com/embed/xyz789?rel=0&autoplay=1&mute=1",
      provider: "youtube",
      title: "Live Cam",
    });
  });

  it("rejects a youtube id that would escape the embed path", () => {
    expect(embed("https://www.youtube.com/watch?v=a/../../b")).toBeNull();
  });

  it("maps vimeo to an iframe", () => {
    expect(embed("https://vimeo.com/123456")).toMatchObject({
      kind: "iframe",
      src: "https://player.vimeo.com/video/123456",
      provider: "vimeo",
    });
  });

  it.each([
    ["https://relay.ozolio.com/pub.cgi?cmd=iframe&oid=CID_XCLW000002D1", "ozolio"],
    ["https://g1.ipcamlive.com/player/player.php?alias=abc", "ipcamlive"],
    ["https://v.angelcam.com/iframe?v=abc&autoplay=1", "angelcam"],
    ["https://www.brownrice.com/embed/some-cam", "brownrice"],
    ["https://cams.example.com/blacks", "cams.example.com"],
  ])("maps default iframe %s with provider %s", (url, provider) => {
    expect(embed(url)).toEqual({ kind: "iframe", src: url, provider, title: "Live Cam" });
  });

  it.each([
    ["https://video.nest.com/live/JKTTcsayyN", "Nest"],
    ["https://www.ozolio.com/explore/IDWX000000A6", "Ozolio"],
    ["https://flaglersurf.com/webcam/", "Flagler Surf"],
    ["https://www.surfline.com/surf-report/inches/5842041f4e65fad6a7708c67", "Surfline"],
    ["https://www.thesurfersview.com/live-cams/some-cam", "The Surfers View"],
  ])("maps external page %s", (pageUrl, provider) => {
    expect(embed(pageUrl)).toEqual({ kind: "external", pageUrl, provider });
  });

  it("returns null for null, undefined and invalid input (none)", () => {
    expect(embed(null)).toBeNull();
    expect(embed(undefined)).toBeNull();
    expect(embed("not a url")).toBeNull();
    expect(embed("javascript:alert(1)")).toBeNull();
  });

  it.each([
    "https://cdn.example.com/cam.mp4",
    "https://cdn.example.com/cam.webm",
    "https://hls.cdn-surfline.com/ohio/pr-inches/playlist.m3u8",
    "https://watch.hdrelay.io/live/cam/index.m3u8",
    "https://hdontap.com/stream/190972/malibu-point-live-surf-cam/",
    "https://portal.hdontap.com/stream/abc",
    "https://www.obhotel.com/webcam",
    "https://embed.cdn-surfline.com/cams/5842041f4e65fad6a7708c67",
  ])("returns null for natively playable %s", (url) => {
    expect(embed(url)).toBeNull();
  });

  it("returns null for non-https iframe and external URLs", () => {
    expect(embed("http://cams.example.com/blacks")).toBeNull();
    expect(embed("http://flaglersurf.com/webcam/")).toBeNull();
  });

  it("emits https even when the source link was http and the provider rewrites it", () => {
    expect(embed("http://youtu.be/xyz789")).toMatchObject({
      kind: "iframe",
      src: expect.stringMatching(/^https:\/\/www\.youtube\.com\/embed\//),
    });
  });

  it("respects licensed-cam overrides (served natively as hdontap)", () => {
    expect(
      toNativeCamEmbed({ kind: "hdontap", pageUrl: "https://portal.hdontap.com/x" }),
    ).toBeNull();
  });

  it("never returns credentials in URLs", () => {
    expect(embed("https://user:pw@cams.example.com/x")).toBeNull();
  });
});
