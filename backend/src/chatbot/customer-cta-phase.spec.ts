import {
    assistantTextImpliesConfirmRecap,
    computeCustomerCtaPhase,
    inferPromptCtaPhaseForUserMessage,
    extractModelState,
    stripModelStateTag,
} from './customer-cta-phase';

describe('customer-cta-phase', () => {
    const emptyGuided = {
        profileLoaded: false,
        draftRequest: {},
    };

    it('recap with numbered list + xác nhận giúp em → CONFIRM_INFO (not incident)', () => {
        const text = `Để tạo yêu cầu cứu hộ, em cần thêm một số thông tin như sau:

1. **Loại sự cố**: Thủng lốp.
2. **Loại xe**: Ô tô.

Anh/chị xác nhận giúp em thông tin trên nhé, sau đó em sẽ tiến hành tạo đơn cứu hộ cho anh/chị.`;

        expect(assistantTextImpliesConfirmRecap(text.toLowerCase())).toBe(true);
        const phase = computeCustomerCtaPhase(text, emptyGuided, 'USER');
        expect(phase).toBe('CONFIRM_INFO');
    });

    it('plain question about loại sự cố → SELECT_ISSUE', () => {
        const text = 'Anh/chị đang gặp loại sự cố nào ạ?';
        expect(assistantTextImpliesConfirmRecap(text.toLowerCase())).toBe(false);
        const phase = computeCustomerCtaPhase(text, emptyGuided, 'USER');
        expect(phase).toBe('SELECT_ISSUE');
    });

    it('non-USER role → GENERAL', () => {
        expect(computeCustomerCtaPhase('anything', emptyGuided, 'PROVIDER')).toBe('GENERAL');
    });

    it('inferPrompt: profile loaded without incident → SELECT_ISSUE before location', () => {
        const phase = inferPromptCtaPhaseForUserMessage({
            profileLoaded: true,
            draftRequest: {
                vehicleType: 'CAR',
                contactPhone: '0901000000',
            },
        });
        expect(phase).toBe('SELECT_ISSUE');
    });

    it('inferPrompt: full mandatory except optional plate/color → LOCATION not ENTER_INFO', () => {
        const phase = inferPromptCtaPhaseForUserMessage({
            profileLoaded: true,
            draftRequest: {
                incidentType: 'FLAT_TIRE',
                vehicleType: 'CAR',
                contactPhone: '0901000000',
            },
        });
        expect(phase).toBe('LOCATION_CHOICE');
    });

    it('compute fallback: profile loaded, no incident → SELECT_ISSUE', () => {
        const phase = computeCustomerCtaPhase(
            'Em đã sẵn sàng hỗ trợ ạ.',
            {
                profileLoaded: true,
                draftRequest: { vehicleType: 'CAR', contactPhone: '0901000000' },
            },
            'USER',
        );
        expect(phase).toBe('SELECT_ISSUE');
    });
});

describe('extractModelState', () => {
    it('parses a valid CONFIRM_INFO tag', () => {
        const text = 'Anh/chị xem lại nhé.\n<!--STATE:{"s":"CONFIRM_INFO"}-->';
        expect(extractModelState(text)).toBe('CONFIRM_INFO');
    });

    it('parses a direct SELECT_ISSUE tag without JSON', () => {
        const text = 'Anh/chị đang gặp sự cố gì?\n<!--STATE:SELECT_ISSUE-->';
        expect(extractModelState(text)).toBe('SELECT_ISSUE');
    });

    it('parses SELECT_ISSUE tag', () => {
        const text = 'Anh/chị đang gặp sự cố gì?\n<!--STATE:{"s":"SELECT_ISSUE"}-->';
        expect(extractModelState(text)).toBe('SELECT_ISSUE');
    });

    it('returns null when no tag is present', () => {
        expect(extractModelState('Câu trả lời bình thường.')).toBeNull();
    });

    it('returns null for unknown phase value', () => {
        const text = '<!--STATE:{"s":"UNKNOWN_PHASE"}-->';
        expect(extractModelState(text)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(extractModelState('')).toBeNull();
    });
});

describe('stripModelStateTag', () => {
    it('removes the tag and trailing newline from the end', () => {
        const text = 'Nội dung câu trả lời.\n<!--STATE:{"s":"GENERAL"}-->';
        const result = stripModelStateTag(text);
        expect(result).not.toContain('<!--STATE:');
        expect(result.trim()).toBe('Nội dung câu trả lời.');
    });

    it('removes the tag in direct string format', () => {
        const text = 'Nội dung câu trả lời.\n<!--STATE:GENERAL-->';
        const result = stripModelStateTag(text);
        expect(result).not.toContain('<!--STATE:');
        expect(result.trim()).toBe('Nội dung câu trả lời.');
    });

    it('does not alter text when no tag is present', () => {
        const text = 'Câu trả lời bình thường.';
        expect(stripModelStateTag(text)).toBe(text);
    });
});

describe('computeCustomerCtaPhase with modelState', () => {
    const emptyGuided = { profileLoaded: false, draftRequest: {} };

    it('modelState CONFIRM_INFO overrides regex → CONFIRM_INFO even on ambiguous text', () => {
        // text contains "loại sự cố" (would normally → SELECT_ISSUE by regex)
        // but model correctly tagged it as CONFIRM_INFO
        const text = 'Nếu anh/chị nhập sai loại sự cố trước đó mình có thể sửa.\nBây giờ anh/chị xem lại cho em nhé.';
        const phase = computeCustomerCtaPhase(text, emptyGuided, 'USER', 'CONFIRM_INFO');
        expect(phase).toBe('CONFIRM_INFO');
    });

    it('modelState GENERAL is trusted and DOES NOT fall back to regex detection', () => {
        const text = 'Anh/chị đang gặp loại sự cố nào ạ?';
        const phase = computeCustomerCtaPhase(text, emptyGuided, 'USER', 'GENERAL');
        // GENERAL model state → trusted over regex → GENERAL
        expect(phase).toBe('GENERAL');
    });

    it('null modelState falls back to regex detection', () => {
        const text = 'Anh/chị đang gặp loại sự cố nào ạ?';
        const phase = computeCustomerCtaPhase(text, emptyGuided, 'USER', null);
        expect(phase).toBe('SELECT_ISSUE');
    });

    it('undefined modelState falls back to guided state', () => {
        const phase = computeCustomerCtaPhase(
            'Em đã sẵn sàng hỗ trợ ạ.',
            { profileLoaded: true, draftRequest: { vehicleType: 'CAR', contactPhone: '0901000000' } },
            'USER',
            undefined,
        );
        expect(phase).toBe('SELECT_ISSUE');
    });
});
