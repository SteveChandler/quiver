function fontFace(family, weight) {
  return `/* latin */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: local('Arial');
}`;
}

module.exports = {
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@100..1000&display=swap":
    fontFace("DM Sans", "100 1000"),
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap":
    fontFace("Space Grotesk", "300 700"),
  "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap":
    `${fontFace("Space Mono", "400")}
${fontFace("Space Mono", "700")}`,
  "https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap":
    fontFace("Caveat", "400 700"),
  "https://fonts.googleapis.com/css2?family=Bowlby+One:wght@400&display=swap":
    fontFace("Bowlby One", "400"),
  "https://fonts.googleapis.com/css2?family=Permanent+Marker:wght@400&display=swap":
    fontFace("Permanent Marker", "400"),
};
