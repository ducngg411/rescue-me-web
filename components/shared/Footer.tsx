export function Footer() {
    return (
        <footer className="border-t bg-muted/50 mt-12">
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <h3 className="font-bold mb-4">RescueMe</h3>
                        <p className="text-sm text-muted-foreground">
                            Emergency assistance when you need it most.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-4">Quick Links</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <a href="/about" className="hover:underline">
                                    About
                                </a>
                            </li>
                            <li>
                                <a href="/services" className="hover:underline">
                                    Services
                                </a>
                            </li>
                            <li>
                                <a href="/contact" className="hover:underline">
                                    Contact
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-4">Legal</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <a href="/privacy" className="hover:underline">
                                    Privacy Policy
                                </a>
                            </li>
                            <li>
                                <a href="/terms" className="hover:underline">
                                    Terms of Service
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
                    © 2025 RescueMe. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
