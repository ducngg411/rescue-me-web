const fs = require('fs');
const file = 'd:\\rescue-me-web\\frontend\\app\\user\\wallet\\page.tsx';
let txt = fs.readFileSync(file, 'utf8');

const r = (from, to) => {
    txt = txt.split(from).join(to);
};

r("Nạp tiền vào ví", "{t('user.wallet.topupModal.title')}");
r("Chuyển khoản qua VietQR", "{t('user.wallet.topupModal.method')}");
r(">Số tiền muốn nạp<", ">{t('user.wallet.topupModal.amountLabel')}<");
r("Số dư sau khi nạp: ", "{t('user.wallet.topupModal.balanceAfter')}");
r("'Đang tạo QR...'", "t('user.wallet.topupModal.generatingQR')");
r("'Tạo mã QR nạp tiền'", "t('user.wallet.topupModal.createQR')");
r("Số tiền cần chuyển", "{t('user.wallet.topupModal.transferAmount')}");

// Hết hạn sau {mins}:{secs}
r("Hết hạn sau {mins}:{secs}", "{t('user.wallet.topupModal.expiresIn').replace('{mins}', mins).replace('{secs}', secs)}");

r(">Ngân hàng<", ">{t('user.wallet.topupModal.bank')}<");
r(">Số tài khoản<", ">{t('user.wallet.topupModal.accountNumber')}<");
r(">Nội dung CK<", ">{t('user.wallet.topupModal.transferContent')}<");
r("⚠️ Nhập chính xác nội dung chuyển khoản để hệ thống tự động xác nhận", "{t('user.wallet.topupModal.warningNote')}");
r(">Đóng<", ">{t('user.wallet.topupModal.close')}<");
r("'Đang kiểm tra...'", "t('user.wallet.topupModal.checking')");
r("'Đã chuyển khoản'", "t('user.wallet.topupModal.transferred')");
r(">Nạp tiền thành công!<", ">{t('user.wallet.topupModal.successTitle')}<");
r(">Số dư ví đã được cập nhật.<", ">{t('user.wallet.topupModal.successSubtitle')}<");
r(">Xong<", ">{t('user.wallet.topupModal.done')}<");
r(">Mã QR đã hết hạn<", ">{t('user.wallet.topupModal.expiredTitle')}<");
r(">Tạo mã mới để tiếp tục nạp tiền.<", ">{t('user.wallet.topupModal.expiredSubtitle')}<");
r(">Tạo mã mới<", ">{t('user.wallet.topupModal.createNewCode')}<");

r("'Không thể tạo QR. Vui lòng thử lại.'", "t('user.wallet.topupModal.errors.createFailed')");
r("'Chưa nhận được thanh toán. Vui lòng thử lại sau.'", "t('user.wallet.topupModal.errors.paymentNotReceived')");
r("'Không thể kiểm tra. Vui lòng thử lại.'", "t('user.wallet.topupModal.errors.checkFailed')");

// Withdraw
r(">Rút tiền<", ">{t('user.wallet.withdrawModal.title')}<");
r("Khả dụng: <strong>", "{t('user.wallet.withdrawModal.available')}<strong>");
r(">Số tiền muốn rút<", ">{t('user.wallet.withdrawModal.amountLabel')}<");
r("Tối thiểu {formatVnd(MIN_WITHDRAWAL)}", "{t('user.wallet.withdrawModal.minAmount').replace('{amount}', formatVnd(MIN_WITHDRAWAL))}");
r("Vượt quá số dư khả dụng", "{t('user.wallet.withdrawModal.overBalance')}");
r("Sau khi rút: <strong", "{t('user.wallet.withdrawModal.balanceAfter')}<strong");
r("Chọn nhanh:", "{t('user.wallet.withdrawModal.quickSelect')}");
r(">Tất cả<", ">{t('user.wallet.withdrawModal.all')}<");
r("💡 Tiền sẽ được chuyển về tài khoản ngân hàng đã đăng ký trong 1–2 ngày làm việc.", "{t('user.wallet.withdrawModal.hint')}");
r(">Hủy<", ">{t('user.wallet.withdrawModal.cancel')}<");
r("'Đang xử lý...'", "t('user.wallet.withdrawModal.processing')");
r("'Xác nhận rút tiền'", "t('user.wallet.withdrawModal.confirm')");
r("'Không thể rút tiền. Vui lòng thử lại.'", "t('user.wallet.withdrawModal.errors.withdrawFailed')");

// TxRow
r(">Ghi chú<", ">{t('user.wallet.txRow.note')}<");
r(">Loại giao dịch<", ">{t('user.wallet.txRow.txType')}<");
r(">Số tiền<", ">{t('user.wallet.txRow.amount')}<");
r(">Mã GD<", ">{t('user.wallet.txRow.txCode')}<");
r("Xem chi tiết chuyến xe", "{t('user.wallet.txRow.viewDetails')}");

r("const REF_LABEL: Record<string, string> = {", `// REF_LABEL is dynamic now`);
r(`    TOPUP: 'Nạp tiền',
    JOB_PAYMENT: 'Thanh toán job',
    REFUND: 'Hoàn tiền',
    WITHDRAW: 'Rút tiền',
    ADJUSTMENT: 'Điều chỉnh',
};`, "");

r("const TX_STATUS_LABEL: Record<string, string> = {", `// TX_STATUS is dynamic now`);
r(`    PENDING: 'Đang xử lý',
    COMPLETED: 'Hoàn thành',
    FAILED: 'Thất bại',
};`, "");

// Modify TxRow component signature to accept t function
r("function TxRow({ tx }: { tx: UserTransaction }) {", "function TxRow({ tx, t }: { tx: UserTransaction, t: any }) {");
// Find where it's called and pass t
r("<TxRow key={tx.id} tx={tx} />", "<TxRow key={tx.id} tx={tx} t={t} />");

// Replace REF_LABEL and TX_STATUS_LABEL usages inside TxRow
r("REF_LABEL[tx.referenceType]", `t('user.wallet.refLabel.' + tx.referenceType)`);
r("TX_STATUS_LABEL[tx.status]", `t('user.wallet.txStatus.' + tx.status)`);

// Main Page
r(">Đang tải ví...<", ">{t('user.wallet.main.loadingWallet')}<");
r(">Tổng số dư<", ">{t('user.wallet.main.totalBalance')}<");
r(">Khả dụng<", ">{t('user.wallet.main.available')}<");
r(">Đang chờ<", ">{t('user.wallet.main.pending')}<");
r(">Nạp tiền<", ">{t('user.wallet.main.topup')}<");

r(`Cần tối thiểu {formatVndFull(MIN_WITHDRAWAL)} để rút tiền`,
    `{t('user.wallet.main.minWithdraw').replace('{amount}', formatVndFull(MIN_WITHDRAWAL))}`);

r(">Số dư khả dụng<", ">{t('user.wallet.main.availableBalance')}<");
r(">Có thể rút ngay<", ">{t('user.wallet.main.canWithdrawNow')}<");
r(">Số dư đang chờ<", ">{t('user.wallet.main.pendingBalance')}<");
// Not ">Đang xử lý<" directly, it might ruin other things
txt = txt.replace(/<p className="text-xs mt-1" style="{{ color: C.gray }}">Đang xử lý<\/p>/g, `<p className="text-xs mt-1" style={{ color: C.gray }}>{t('user.wallet.main.processing')}</p>`);

r(">Giao dịch đang chờ thanh toán<", ">{t('user.wallet.main.pendingTopupTitle')}<");
r("Hết hạn lúc {new Date(pendingTopup.expireAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}", "{t('user.wallet.main.expiresAt').replace('{time}', new Date(pendingTopup.expireAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }))}");
r(">Tiếp tục<", ">{t('user.wallet.main.continue')}<");
r(">Lịch sử giao dịch<", ">{t('user.wallet.main.txHistory')}<");
r(">{txData.total} giao dịch<", ">{t('user.wallet.main.txCount').replace('{count}', String(txData.total))}<");
r(">Đang tải giao dịch...<", ">{t('user.wallet.main.loadingTx')}<");
r(">Chưa có giao dịch nào<", ">{t('user.wallet.main.noTxTitle')}<");
r(">Nạp tiền để bắt đầu sử dụng ví<", ">{t('user.wallet.main.noTxSubtitle')}<");
r("><><ChevronUp className=\"w-4 h-4\" />Thu gọn</><", "> <><ChevronUp className=\"w-4 h-4\" />{t('user.wallet.main.collapse')}</> <");
r("><><ChevronDown className=\"w-4 h-4\" />Xem thêm ({items.length - 5})</><", "> <><ChevronDown className=\"w-4 h-4\" />{t('user.wallet.main.showMore').replace('{count}', String(items.length - 5))}</> <");
r(">← Trước<", ">{t('user.wallet.main.prev')}<");
r(">Sau →<", ">{t('user.wallet.main.next')}<");
r("Cập nhật lần cuối: {formatDate(wallet.updatedAt)}", "{t('user.wallet.main.lastUpdated').replace('{date}', formatDate(wallet.updatedAt))}");

// Pass t to TopupModal and WithdrawModal
r("function TopupModal({ initialQrData, onClose, onSuccess }", "function TopupModal({ initialQrData, onClose, onSuccess, t }");
r("onSuccess={() => { setPendingTopup(null); loadWallet(); loadTransactions(0); }}", "onSuccess={() => { setPendingTopup(null); loadWallet(); loadTransactions(0); }}\n                    t={t}");
r("function WithdrawModal({ availableBalance, onClose, onSuccess }", "function WithdrawModal({ availableBalance, onClose, onSuccess, t }");
r("onSuccess={() => { setShowWithdraw(false); loadWallet(); loadTransactions(0); }}", "onSuccess={() => { setShowWithdraw(false); loadWallet(); loadTransactions(0); }}\n                    t={t}");


fs.writeFileSync(file, txt);
console.log('done');
