/**
 * Chat bubbles render plain text. Models often emit markdown **bold**, which
 * would show literally — strip paired **...** and any leftover **.
 * Markdown images ![alt](url) are removed: TOPUP_QR (and similar) already shows
 * the QR in the chat UI; duplicating the image URL in the bubble is noisy.
 */
export function assistantPlainTextForChatUi(text: string): string {
    if (!text) return text;
    let s = text;
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
