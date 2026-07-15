/**
 * Склеивает «мягкие» переносы строк из разметки форума (br/div) внутри предложения.
 * Держите в синхроне с src/shared/normalizeArticleText.cjs
 */
function normalizeArticleText(text) {
  if (!text) return '';

  let result = String(text)
    .replace(/\u200b/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n?Нажмите, чтобы раскрыть\.\.\.[\s\u200B]*/gi, '');

  result = result.replace(/(\S)\s*\n\s*([.,;:])\s*(?=\n|$)/gm, '$1$2');
  result = result.replace(/([,;:\-–—)])\s*\n\s*(?=[а-яёa-z0-9(«"])/gi, '$1 ');
  result = result.replace(/([^\n.!?…])\n(?=[а-яёa-z0-9(«"])/g, '$1 ');
  result = result.replace(/\.\s*\n\s*(?=[а-яё])/g, '. ');
  result = result.replace(/[ \t]+/g, ' ');

  return result.trim();
}
