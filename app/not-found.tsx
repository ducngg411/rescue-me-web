export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-6xl font-bold mb-4">404</h1>
                <p className="text-xl text-muted-foreground mb-6">Page not found</p>
                <a href="/" className="px-6 py-3 bg-primary text-primary-foreground rounded-md inline-block">
                    Go Home
                </a>
            </div>
        </div>
    );
}
