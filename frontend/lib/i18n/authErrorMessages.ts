export function resolveAuthErrorMessage(
    rawMessage: unknown,
    t: (path: string) => string,
    fallbackKey: string,
): string {
    const normalized = Array.isArray(rawMessage)
        ? String(rawMessage[0] ?? '').trim()
        : String(rawMessage ?? '').trim();

    if (!normalized) return t(fallbackKey);

    const lookup: Record<string, string> = {
        'Email đã được sử dụng': 'auth.errors.emailAlreadyUsed',
        'Email hoặc mật khẩu không chính xác': 'auth.errors.invalidCredentials',
        'Tài khoản này được tạo bằng Google. Vui lòng đăng nhập bằng Google': 'auth.errors.googleAccountUseGoogleLogin',
        'Google token không hợp lệ': 'auth.errors.invalidGoogleToken',
        'Xác thực Google thất bại': 'auth.errors.googleAuthFailed',
    };

    const key = lookup[normalized];
    return key ? t(key) : normalized;
}
