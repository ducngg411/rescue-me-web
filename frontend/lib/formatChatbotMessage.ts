/**
 * Chat bubbles render plain text. Models often emit markdown **bold**, which
 * would show literally — strip paired **...** and any leftover **. 
 * Markdown images ![alt](url) are removed: TOPUP_QR (and similar) already shows
 * the QR in the chat UI; duplicating the image URL in the bubble is noisy.
 * Hidden STATE tags <!--STATE:...--> are stripped: backend reads them for CTA phase
 * and removes them before persisting, but streaming deltas arrive raw to the frontend.
 */
export function assistantPlainTextForChatUi(text: string): string {
    if (!text) return text;
    let s = text;
    // Strip hidden state tags emitted by the model (both JSON and direct formats)
    s = s.replace(/\n?<!--STATE:(?:\{"s":"[A-Z_]+"\}|[A-Z_]+)-->\n?/g, '\n');
    s = s.replace(/\s*!\[[^\]]*\]\([^)]+\)\s*/g, '\n');
    s = s.replace(/\n{3,}/g, '\n\n');
    let prev = '';
    while (s !== prev) {
        prev = s;
        s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
    }
    s = s.replace(/\*\*/g, '');
    return s.trim();
}
