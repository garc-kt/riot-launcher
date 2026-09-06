// Extract @import and @font-face rules that misbehave inside constructable stylesheets in CEF
export function extractSpecialRules(css: string | null | undefined): { cleanedCss: string; specialCss: string } {
  if (!css || typeof css !== 'string') {
    return { cleanedCss: '', specialCss: '' };
  }

  const importRegex = /@import\s+(?:url\([^)]+\)|"[^"]+"|'[^']+'|[^;]+);/gi;
  const fontFaceRegex = /@font-face\s*\{[\s\S]*?\}/gi;

  const specialParts: string[] = [];

  const cleaned = css
    .replace(importRegex, (match) => {
      specialParts.push(match.trim());
      return '';
    })
    .replace(fontFaceRegex, (match) => {
      specialParts.push(match.trim());
      return '';
    });

  return {
    cleanedCss: cleaned.trim(),
    specialCss: specialParts.join('\n').trim(),
  };
}
