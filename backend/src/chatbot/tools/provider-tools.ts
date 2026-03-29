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
            name: 'initiate_topup',
            description:
                'Tạo giao dịch nạp tiền vào ví provider và trả về QR code để chuyển khoản. QR có hiệu lực 5 phút. Tối thiểu 100,000 VND.',
            parameters: {
                type: 'object',
                properties: {
                    amount: {
                        type: 'number',
                        description: 'Số tiền nạp (VND). Tối thiểu 100,000.',
                    },
                },
                required: ['amount'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'check_topup_status',
            description:
                'Kiểm tra trạng thái giao dịch nạp tiền. Gọi khi provider báo đã chuyển khoản.',
            parameters: {
                type: 'object',
                properties: {
                    topupTxId: {
                        type: 'string',
                        description: 'ID giao dịch nạp tiền (từ kết quả initiate_topup)',
                    },
                },
                required: ['topupTxId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'initiate_withdrawal',
            description:
                'Tạo yêu cầu rút tiền từ ví provider về ngân hàng. Tối thiểu 50,000 VND. CHỈ gọi sau khi provider xác nhận thông tin.',
            parameters: {
                type: 'object',
                properties: {
                    amount: {
                        type: 'number',
                        description: 'Số tiền rút (VND). Tối thiểu 50,000.',
                    },
                    bankName: {
                        type: 'string',
                        description: 'Tên ngân hàng',
                    },
                    accountNumber: {
                        type: 'string',
                        description: 'Số tài khoản ngân hàng',
                    },
                    accountHolderName: {
                        type: 'string',
                        description: 'Tên chủ tài khoản (in hoa)',
                    },
                    withdrawalAccountId: {
                        type: 'string',
                        description: 'ID tài khoản rút tiền đã lưu (nếu có)',
                    },
                },
                required: ['amount'],
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
