import { ChatCompletionTool } from 'openai/resources/chat/completions';

export const PROVIDER_TOOLS: ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'get_my_earnings',
            description:
                'Lấy thu nhập theo đơn đã hoàn thành (COMPLETED/PAID): doanh thu cuốc (gồm CASH, không phụ thuộc ghi có ví), hoa hồng ước tính, thực nhận ước tính, số đơn.',
            parameters: {
                type: 'object',
                properties: {
                    period: {
                        type: 'string',
                        description: 'Khoảng thời gian',
                        enum: ['today', 'this_week', 'this_month', 'all_time'],
                    },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_wallet_balance',
            description:
                'Lấy thông tin số dư ví provider hiện tại.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_active_request',
            description:
                'Lấy đơn cứu hộ đang xử lý (ASSIGNED, IN_PROGRESS, ARRIVED, WORKING, PAYMENT_PENDING) của provider.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_verification_guide',
            description:
                'Lấy hướng dẫn xác minh tài khoản provider và trạng thái xác minh hiện tại.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_my_requests',
            description:
                'Lấy lịch sử đơn cứu hộ đã nhận. Trả về tối đa 10 đơn gần nhất.',
            parameters: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        description: 'Lọc theo trạng thái.',
                        enum: [
                            'ASSIGNED',
                            'IN_PROGRESS',
                            'ARRIVED',
                            'WORKING',
                            'PAYMENT_PENDING',
                            'COMPLETED',
                            'CANCELLED',
                        ],
                    },
                },
                required: [],
            },
        },
    },
];
