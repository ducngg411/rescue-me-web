export interface AutofillFlowScenario {
    id: string;
    title: string;
    steps: string[];
    expected: string[];
}

export const AUTOFILL_RESCUE_FLOW_SCENARIOS: AutofillFlowScenario[] = [
    {
        id: 'AF-01',
        title: 'Auto-fill from profile and choose current location',
        steps: [
            'User: "Tạo yêu cầu cứu hộ giúp tôi"',
            'Bot calls get_profile_defaults',
            'User clicks "Dùng vị trí hiện tại"',
            'User confirms recap',
        ],
        expected: [
            'Bot does not ask again for contact phone if available in profile',
            'Bot does not ask again for vehicle type/license plate if profile defaults exist',
            'Bot asks only location confirmation (current vs other)',
            'Bot calls create_rescue_request with pickupLocation.addressText/lat/lng',
            'Frontend redirects to /user/requests/:id',
        ],
    },
    {
        id: 'AF-02',
        title: 'Choose other location through VietMap picker',
        steps: [
            'User: "Tôi muốn tạo đơn cứu hộ"',
            'User clicks "Nhập vị trí khác"',
            'User selects address on LocationPicker',
            'User confirms location',
        ],
        expected: [
            'Selected location contains addressText, lat, lng',
            'Bot recap uses selected location',
            'No extra manual address text required',
        ],
    },
    {
        id: 'AF-03',
        title: 'User edits one field before confirm',
        steps: [
            'Bot shows recap',
            'User says: "Đổi số điện thoại thành 0901234567"',
            'User confirms create',
        ],
        expected: [
            'Bot updates draft contactPhone and reflects in recap',
            'Bot calls create_rescue_request only after explicit confirm',
        ],
    },
    {
        id: 'AF-04',
        title: 'Media evidence optional question',
        steps: [
            'Bot has enough mandatory fields',
            'Bot asks user if they want to attach evidence images/videos',
            'User skips media',
            'User confirms create',
        ],
        expected: [
            'Bot asks media only once',
            'Flow still continues when user skips',
            'Request creation succeeds without media',
        ],
    },
    {
        id: 'AF-05',
        title: 'Redirect event from tool result',
        steps: [
            'Tool create_rescue_request returns success + request.id',
            'Backend sends SSE action redirect_request_detail',
            'Frontend receives action event',
        ],
        expected: [
            'Frontend calls router.push(`/user/requests/${id}`)',
            'No duplicate redirects for one creation event',
        ],
    },
    {
        id: 'AF-06',
        title: 'Compatibility with FAQ conversations',
        steps: [
            'User asks: "Làm sao nạp ví?"',
            'User asks: "Cách khiếu nại đơn?"',
        ],
        expected: [
            'Bot answers FAQ normally',
            'Bot does not force create request flow',
        ],
    },
];

