export function Navbar() {
    return (
        <nav className="border-b bg-background">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                <a href="/" className="text-xl font-bold">
                    RescueMe
                </a>
                <div className="flex gap-4">
                    <a href="/login" className="hover:underline">
                        Login
                    </a>
                    <a href="/register" className="hover:underline">
                        Sign Up
                    </a>
                </div>
            </div>
        </nav>
    );
}
