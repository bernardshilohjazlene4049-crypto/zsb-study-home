// Compare legacy page snapshots without the independently checked video blocks.
export const stripVideosV1 = (html) =>
  html.replace(/\n<!-- videos-v1:start -->\n[\s\S]*?<!-- videos-v1:end -->\n/g, "");
