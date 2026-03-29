/**
 * Chat bubbles render plain text. Models often emit markdown **bold**, which
 * would show literally — strip paired **...** and any leftover **.
 */
export function assistantPlainTextForChatUi(text: string): string {
    if (!text) return text;
    let s = text;
    let prev = '';
    while (s !== prev) {
        prev = s;
        s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
    }
    s = s.replace(/\*\*/g, '');
    return s;
}
