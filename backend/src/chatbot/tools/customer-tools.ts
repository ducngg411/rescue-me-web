import { ChatCompletionTool } from 'openai/resources/chat/completions';

export const CUSTOMER_TOOLS: ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'get_profile_defaults',
            description:
                'Lấy thông tin mặc định của khách hàng đã đăng nhập để tạo yêu cầu cứu hộ nhanh: số điện thoại, xe mặc định, biển số, màu xe.',
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
                'Lấy danh sách đơn cứu hộ của khách hàng. Trả về tối đa 10 đơn gần nhất với trạng thái, loại sự cố, thời gian tạo.',
            parameters: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        description:
                            'Lọc theo trạng thái. Để trống để lấy tất cả.',
                        enum: [
                            'MATCHING',
                            'ASSIGNED',
                            'IN_PROGRESS',
                            'ARRIVED',
                            'WORKING',
                            'PAYMENT_PENDING',
                            'COMPLETED',
                            'CANCELLED',
                            'EXPIRED',
                        ],
                    },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_request_status',
            description:
                'Lấy chi tiết trạng thái một đơn cứu hộ cụ thể theo ID hoặc mã đơn.',
            parameters: {
                type: 'object',
                properties: {
                    requestId: {
                        type: 'string',
                        description: 'ID hoặc mã đơn (orderCode) của yêu cầu cứu hộ',
                    },
                },
                required: ['requestId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_wallet_balance',
            description:
                'Lấy thông tin số dư ví của người dùng hiện tại.',
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
            name: 'analyze_vehicle_image',
            description:
                'Phân tích ảnh xe/sự cố mà khách hàng gửi. Trả về JSON gồm incidentType, confidence, riskLevel, needsRescueNow, reasons, missingInfo. Chỉ gọi khi người dùng đã gửi ảnh trong tin nhắn.',
            parameters: {
                type: 'object',
                properties: {
                    analysisPrompt: {
                        type: 'string',
                        description:
                            'Câu hỏi hoặc yêu cầu cụ thể khi phân tích ảnh',
                    },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_incident_types',
            description:
                'Lấy danh sách các loại sự cố hỗ trợ và mô tả của chúng.',
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
            name: 'create_rescue_request',
            description:
                'Tạo yêu cầu cứu hộ mới cho khách hàng. CHỈ gọi sau khi đã thu thập đủ thông tin bắt buộc VÀ khách đã xác nhận đồng ý tạo đơn. Trả về thông tin đơn đã tạo.',
            parameters: {
                type: 'object',
                properties: {
                    incidentType: {
                        type: 'string',
                        description: 'Loại sự cố',
                        enum: ['BREAKDOWN', 'ACCIDENT', 'FLAT_TIRE', 'BATTERY_DEAD', 'OUT_OF_FUEL', 'LOCKED_OUT', 'OTHER'],
                    },
                    vehicleType: {
                        type: 'string',
                        description: 'Loại xe',
                        enum: ['CAR', 'MOTORCYCLE'],
                    },
                    pickupAddress: {
                        type: 'string',
                        description: 'Địa chỉ đón khách (text mô tả vị trí)',
                    },
                    pickupLocation: {
                        type: 'object',
                        description:
                            'Vị trí đón chuẩn với addressText, lat, lng. Ưu tiên dùng object này thay vì pickupAddress text.',
                        properties: {
                            addressText: {
                                type: 'string',
                            },
                            lat: {
                                type: 'number',
                            },
                            lng: {
                                type: 'number',
                            },
                        },
                        required: ['addressText', 'lat', 'lng'],
                    },
                    contactPhone: {
                        type: 'string',
                        description: 'Số điện thoại liên hệ',
                    },
                    description: {
                        type: 'string',
                        description: 'Mô tả thêm về sự cố (tùy chọn)',
                    },
                    licensePlate: {
                        type: 'string',
                        description: 'Biển số xe (tùy chọn)',
                    },
                    vehicleColor: {
                        type: 'string',
                        description: 'Màu xe (tùy chọn)',
                    },
                    mediaUrls: {
                        type: 'array',
                        description: 'Danh sách ảnh/video bằng chứng (URL) nếu có',
                        items: { type: 'string' },
                    },
                },
                required: ['incidentType', 'vehicleType', 'contactPhone'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'initiate_topup',
            description:
                'Tạo giao dịch nạp tiền vào ví và trả về QR code để chuyển khoản. Hệ thống sẽ tự động ghi có khi nhận được tiền. QR có hiệu lực 5 phút.',
            parameters: {
                type: 'object',
                properties: {
                    amount: {
                        type: 'number',
                        description: 'Số tiền nạp (VND). Tối thiểu 1 VND với khách hàng.',
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
                'Kiểm tra trạng thái giao dịch nạp tiền. Gọi khi người dùng báo đã chuyển khoản hoặc yêu cầu kiểm tra.',
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
            name: 'get_withdrawal_accounts',
            description:
                'Lấy danh sách tài khoản ngân hàng đã lưu của khách hàng để rút tiền. Gọi tool này trước khi hỏi thông tin ngân hàng khi khách muốn rút tiền.',
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
            name: 'initiate_withdrawal',
            description:
                'Tạo yêu cầu rút tiền từ ví về ngân hàng. Tối thiểu 50,000 VND. CHỈ gọi sau khi người dùng xác nhận đầy đủ thông tin ngân hàng.',
            parameters: {
                type: 'object',
                properties: {
                    amount: {
                        type: 'number',
                        description: 'Số tiền rút (VND). Tối thiểu 50,000.',
                    },
                    bankName: {
                        type: 'string',
                        description: 'Tên ngân hàng (ví dụ: Vietcombank, Techcombank...)',
                    },
                    accountNumber: {
                        type: 'string',
                        description: 'Số tài khoản ngân hàng',
                    },
                    accountHolderName: {
                        type: 'string',
                        description: 'Tên chủ tài khoản (in hoa, đúng như trên thẻ)',
                    },
                    withdrawalAccountId: {
                        type: 'string',
                        description: 'ID tài khoản rút tiền đã lưu (nếu có, thay thế cho các trường ngân hàng)',
                    },
                },
                required: ['amount'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'lookup_order_for_complaint',
            description:
                'Tra cứu đơn cứu hộ đã hoàn thành để chuẩn bị mở khiếu nại. Kiểm tra đơn có đủ điều kiện khiếu nại không (đã hoàn thành, đã thanh toán, chưa có khiếu nại). Trả về requestId, paymentId, và số tiền tối đa có thể khiếu nại.',
            parameters: {
                type: 'object',
                properties: {
                    orderCode: {
                        type: 'string',
                        description: 'Mã đơn hàng (dạng RMO-...) hoặc ID đơn',
                    },
                },
                required: ['orderCode'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'open_complaint',
            description:
                'Mở khiếu nại cho đơn cứu hộ đã hoàn thành. CHỈ gọi sau khi đã có requestId và paymentId từ lookup_order_for_complaint VÀ khách đã xác nhận đồng ý gửi khiếu nại.',
            parameters: {
                type: 'object',
                properties: {
                    requestId: {
                        type: 'string',
                        description: 'ID đơn cứu hộ (lấy từ lookup_order_for_complaint)',
                    },
                    paymentId: {
                        type: 'string',
                        description: 'ID thanh toán (lấy từ lookup_order_for_complaint)',
                    },
                    reason: {
                        type: 'string',
                        description: 'Lý do khiếu nại (bắt buộc)',
                    },
                    targetAmount: {
                        type: 'number',
                        description: 'Số tiền yêu cầu bồi thường (VND). Dùng maxDisputeAmount nếu khách không nêu rõ.',
                    },
                    description: {
                        type: 'string',
                        description: 'Mô tả chi tiết sự việc (tùy chọn)',
                    },
                    expectedOutcome: {
                        type: 'string',
                        description: 'Kết quả mong muốn, ví dụ: hoàn tiền, xin lỗi công khai (tùy chọn)',
                    },
                    attachmentUrls: {
                        type: 'array',
                        description: 'Danh sách URL ảnh/video bằng chứng (tùy chọn)',
                        items: { type: 'string' },
                    },
                },
                required: ['requestId', 'paymentId', 'reason', 'targetAmount'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'estimate_price_range',
            description:
                'Ước tính khoảng giá dịch vụ cứu hộ dựa trên loại sự cố và loại xe. Đây là giá tham khảo, giá thực tế phụ thuộc vào báo giá của provider.',
            parameters: {
                type: 'object',
                properties: {
                    incidentType: {
                        type: 'string',
                        description: 'Loại sự cố',
                        enum: ['BREAKDOWN', 'ACCIDENT', 'FLAT_TIRE', 'BATTERY_DEAD', 'OUT_OF_FUEL', 'LOCKED_OUT', 'OTHER'],
                    },
                    vehicleType: {
                        type: 'string',
                        description: 'Loại xe',
                        enum: ['CAR', 'MOTORCYCLE'],
                    },
                },
                required: ['incidentType', 'vehicleType'],
            },
        },
    },
];
