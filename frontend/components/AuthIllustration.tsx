export default function AuthIllustration() {
    return (
        <svg
            viewBox="0 0 800 600"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid slice"
        >
            <defs>
                {/* Sky gradient - warm night/dusk */}
                <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1a1a4e" />
                    <stop offset="55%" stopColor="#2d2d72" />
                    <stop offset="100%" stopColor="#3d3580" />
                </linearGradient>
                {/* Road gradient */}
                <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2a2a3a" />
                    <stop offset="100%" stopColor="#1a1a28" />
                </linearGradient>
                {/* Ground/curb */}
                <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3a3a50" />
                    <stop offset="100%" stopColor="#28283c" />
                </linearGradient>
                {/* Tow truck body */}
                <linearGradient id="truckBody" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#ea6c0a" />
                </linearGradient>
                {/* Amber warning light glow */}
                <radialGradient id="warningGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
                    <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </radialGradient>
                {/* Headlight beam */}
                <radialGradient id="headlight" cx="0%" cy="50%" r="100%">
                    <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#fef9c3" stopOpacity="0" />
                </radialGradient>
                {/* Car body */}
                <linearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
                {/* Motorcycle body */}
                <linearGradient id="motoBody" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
                {/* Stars */}
                <filter id="starGlow">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                {/* Soft shadow */}
                <filter id="softShadow" x="-20%" y="0%" width="140%" height="200%">
                    <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.4" />
                </filter>
                {/* Building shadow */}
                <filter id="buildShadow">
                    <feDropShadow dx="-3" dy="4" stdDeviation="5" floodColor="#000" floodOpacity="0.3" />
                </filter>

                <clipPath id="sceneClip">
                    <rect width="800" height="600" />
                </clipPath>
            </defs>

            <g clipPath="url(#sceneClip)">

                {/* ====== SKY ====== */}
                <rect width="800" height="600" fill="url(#sky)" />

                {/* Stars */}
                {[
                    [60, 40], [120, 25], [200, 55], [280, 30], [350, 18], [430, 42], [520, 28], [600, 50], [680, 22], [740, 38],
                    [90, 80], [170, 65], [310, 90], [460, 70], [570, 85], [700, 60], [155, 110], [390, 95], [640, 100], [760, 80],
                    [40, 130], [240, 120], [480, 115], [720, 125], [800, 90],
                ].map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.5 : 1} fill="white" opacity={i % 4 === 0 ? 0.9 : 0.55} filter="url(#starGlow)" />
                ))}

                {/* Moon */}
                <circle cx="680" cy="80" r="36" fill="#f1e9c9" opacity="0.15" />
                <circle cx="680" cy="80" r="28" fill="#fef3c7" opacity="0.2" />
                <circle cx="680" cy="80" r="20" fill="#fef9c3" opacity="0.85" />
                {/* Moon craters */}
                <circle cx="673" cy="74" r="3" fill="#fde68a" opacity="0.6" />
                <circle cx="682" cy="85" r="2" fill="#fde68a" opacity="0.5" />
                <circle cx="687" cy="76" r="1.5" fill="#fde68a" opacity="0.5" />

                {/* ====== CITY SKYLINE (background) ====== */}
                {/* Far buildings - dark silhouette */}
                <rect x="0" y="250" width="70" height="200" fill="#1e1e40" opacity="0.6" />
                <rect x="15" y="220" width="40" height="230" fill="#222248" opacity="0.6" />
                {/* windows */}
                {[[20, 230], [20, 250], [20, 270], [20, 290], [40, 230], [40, 250], [40, 270], [40, 290], [40, 310]].map(([wx, wy], i) => (
                    <rect key={i} x={wx} y={wy} width="8" height="6" rx="1" fill="#fbbf24" opacity={i % 3 === 0 ? 0.8 : 0.2} />
                ))}

                <rect x="60" y="180" width="55" height="280" fill="#1e1e45" opacity="0.7" />
                <rect x="75" y="160" width="25" height="300" fill="#232350" opacity="0.7" />
                {[[65, 190], [65, 210], [65, 230], [65, 250], [65, 270], [85, 190], [85, 210], [85, 250], [85, 270], [95, 170], [95, 190], [95, 210], [95, 230]].map(([wx, wy], i) => (
                    <rect key={i} x={wx} y={wy} width="7" height="5" rx="1" fill="#fbbf24" opacity={i % 4 === 0 ? 0.9 : i % 2 === 0 ? 0.3 : 0.1} />
                ))}

                <rect x="130" y="200" width="80" height="260" fill="#1c1c42" opacity="0.75" />
                <rect x="145" y="170" width="50" height="290" fill="#202248" opacity="0.75" />
                {[[135, 210], [135, 235], [135, 260], [135, 285], [160, 210], [160, 235], [160, 260], [160, 285], [160, 310], [180, 180], [180, 210], [180, 235], [180, 260]].map(([wx, wy], i) => (
                    <rect key={i} x={wx} y={wy} width="8" height="6" rx="1" fill="#93c5fd" opacity={i % 3 === 0 ? 0.6 : 0.15} />
                ))}

                <rect x="220" y="230" width="60" height="230" fill="#1e1e44" opacity="0.65" />
                {[[225, 240], [225, 260], [225, 280], [245, 240], [245, 260], [245, 280], [245, 300], [265, 240], [265, 260]].map(([wx, wy], i) => (
                    <rect key={i} x={wx} y={wy} width="7" height="5" rx="1" fill="#fbbf24" opacity={i % 2 === 0 ? 0.7 : 0.2} />
                ))}

                <rect x="650" y="210" width="75" height="250" fill="#1c1c42" opacity="0.65" />
                <rect x="665" y="185" width="45" height="275" fill="#20204a" opacity="0.65" />
                {[[655, 220], [655, 245], [655, 270], [655, 295], [680, 220], [680, 245], [680, 270], [695, 195], [695, 220], [695, 245]].map(([wx, wy], i) => (
                    <rect key={i} x={wx} y={wy} width="8" height="6" rx="1" fill="#fbbf24" opacity={i % 3 === 0 ? 0.85 : 0.2} />
                ))}

                <rect x="730" y="240" width="90" height="220" fill="#1a1a3e" opacity="0.6" />
                {[[735, 255], [735, 278], [760, 255], [760, 278], [760, 302], [780, 255], [780, 278]].map(([wx, wy], i) => (
                    <rect key={i} x={wx} y={wy} width="9" height="6" rx="1" fill="#93c5fd" opacity={i % 2 === 0 ? 0.5 : 0.15} />
                ))}

                {/* ====== GROUND / ROAD ====== */}
                {/* Sidewalk / curb */}
                <rect x="0" y="440" width="800" height="20" fill="#3a3a52" />
                {/* Road surface */}
                <rect x="0" y="460" width="800" height="140" fill="url(#road)" />

                {/* Road lane markings */}
                {/* Center dashes */}
                {[0, 80, 160, 240, 320, 400, 480, 560, 640, 720].map((x, i) => (
                    <rect key={i} x={x} y="527" width="55" height="6" rx="3" fill="#f1f5f9" opacity="0.15" />
                ))}
                {/* Road edge lines */}
                <rect x="0" y="462" width="800" height="3" rx="1" fill="#f1f5f9" opacity="0.12" />
                <rect x="0" y="595" width="800" height="3" rx="1" fill="#f1f5f9" opacity="0.08" />

                {/* Curb edge highlight */}
                <rect x="0" y="458" width="800" height="3" rx="1" fill="#6366f1" opacity="0.3" />

                {/* ====== STREET LIGHT (left) ====== */}
                <rect x="82" y="340" width="6" height="110" rx="3" fill="#4a4a60" />
                <path d="M85 340 Q85 318 102 318 L120 318" stroke="#4a4a60" strokeWidth="5" fill="none" strokeLinecap="round" />
                {/* Lamp */}
                <rect x="113" y="312" width="20" height="10" rx="4" fill="#fef3c7" />
                <ellipse cx="123" cy="322" rx="22" ry="30" fill="#fef9c3" opacity="0.12" />

                {/* ====== STREET LIGHT (right) ====== */}
                <rect x="712" y="340" width="6" height="110" rx="3" fill="#4a4a60" />
                <path d="M715 340 Q715 318 698 318 L680 318" stroke="#4a4a60" strokeWidth="5" fill="none" strokeLinecap="round" />
                <rect x="667" y="312" width="20" height="10" rx="4" fill="#fef3c7" />
                <ellipse cx="677" cy="322" rx="22" ry="30" fill="#fef9c3" opacity="0.12" />

                {/* ====== HEADLIGHT BEAM (tow truck) ====== */}
                <polygon points="490,490 490,510 760,540 760,460" fill="url(#headlight)" opacity="0.18" />

                {/* ====== WARNING GLOW (scene ambiance) ====== */}
                <ellipse cx="430" cy="440" rx="200" ry="60" fill="#f97316" opacity="0.07" />

                {/* ====== TOW TRUCK (main hero, right side) ====== */}
                <g transform="translate(420, 390)" filter="url(#softShadow)">
                    {/* Truck cabin */}
                    <rect x="100" y="30" width="120" height="80" rx="8" fill="url(#truckBody)" />
                    {/* Cabin roof */}
                    <path d="M108 30 Q115 8 175 8 L212 8 Q220 8 220 28 L220 30 Z" fill="#fb923c" />
                    {/* Windshield */}
                    <rect x="110" y="15" width="75" height="42" rx="5" fill="#bfdbfe" opacity="0.75" />
                    {/* Windshield glare */}
                    <rect x="114" y="18" width="20" height="36" rx="3" fill="white" opacity="0.25" />
                    {/* Door */}
                    <rect x="138" y="42" width="38" height="42" rx="4" fill="#ea6c0a" />
                    <rect x="142" y="48" width="30" height="28" rx="3" fill="#fed7aa" opacity="0.3" />
                    {/* Door handle */}
                    <rect x="172" y="62" width="10" height="4" rx="2" fill="#c2410c" />

                    {/* Truck bed / flatbed */}
                    <rect x="0" y="55" width="108" height="20" rx="4" fill="#c2410c" />
                    <rect x="4" y="48" width="104" height="10" rx="3" fill="#ea6c0a" />
                    {/* Flatbed planks */}
                    {[8, 24, 40, 56, 72, 88].map((x, i) => (
                        <rect key={i} x={x} y="60" width="12" height="12" rx="1" fill="#9a3412" opacity="0.5" />
                    ))}

                    {/* TOW ARM / CRANE */}
                    <rect x="10" y="20" width="10" height="40" rx="3" fill="#7c2d12" />
                    <line x1="15" y1="20" x2="65" y2="-15" stroke="#9a3412" strokeWidth="7" strokeLinecap="round" />
                    <line x1="65" y1="-15" x2="65" y2="30" stroke="#9a3412" strokeWidth="4" strokeLinecap="round" strokeDasharray="4 3" />
                    {/* Hook */}
                    <path d="M60 30 Q55 38 62 42 Q70 46 72 38" stroke="#6b7280" strokeWidth="3.5" fill="none" strokeLinecap="round" />

                    {/* Warning light bar on cabin roof */}
                    <rect x="125" y="4" width="85" height="7" rx="3" fill="#374151" />
                    {/* Flashing lights */}
                    <circle cx="138" cy="7" r="4" fill="#fbbf24" opacity="0.95" />
                    <ellipse cx="138" cy="7" rx="14" ry="14" fill="url(#warningGlow)" opacity="0.8" />
                    <circle cx="155" cy="7" r="3" fill="#ef4444" opacity="0.7" />
                    <circle cx="170" cy="7" r="4" fill="#fbbf24" opacity="0.95" />
                    <ellipse cx="170" cy="7" rx="14" ry="14" fill="url(#warningGlow)" opacity="0.7" />
                    <circle cx="187" cy="7" r="3" fill="#ef4444" opacity="0.7" />
                    <circle cx="202" cy="7" r="4" fill="#fbbf24" opacity="0.9" />

                    {/* Headlights */}
                    <rect x="218" y="58" width="10" height="14" rx="3" fill="#fef9c3" />
                    <ellipse cx="228" cy="65" rx="16" ry="10" fill="#fef9c3" opacity="0.4" />
                    {/* Tail lights */}
                    <rect x="0" y="62" width="8" height="10" rx="2" fill="#ef4444" opacity="0.85" />

                    {/* Truck body stripe */}
                    <rect x="100" y="80" width="120" height="5" rx="2" fill="#c2410c" opacity="0.6" />

                    {/* Rescue Me text on truck side */}
                    <rect x="25" y="62" width="72" height="14" rx="3" fill="white" opacity="0.12" />

                    {/* Exhaust pipes */}
                    <rect x="218" y="40" width="6" height="25" rx="3" fill="#374151" />
                    <ellipse cx="221" cy="40" rx="5" ry="3" fill="#6b7280" opacity="0.5" />

                    {/* Wheels */}
                    {/* Front wheel */}
                    <circle cx="190" cy="110" r="28" fill="#1f2937" />
                    <circle cx="190" cy="110" r="20" fill="#374151" />
                    <circle cx="190" cy="110" r="10" fill="#6b7280" />
                    <circle cx="190" cy="110" r="5" fill="#9ca3af" />
                    {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                        <line key={i}
                            x1={190 + 10 * Math.cos(deg * Math.PI / 180)}
                            y1={110 + 10 * Math.sin(deg * Math.PI / 180)}
                            x2={190 + 19 * Math.cos(deg * Math.PI / 180)}
                            y2={110 + 19 * Math.sin(deg * Math.PI / 180)}
                            stroke="#9ca3af" strokeWidth="2.5"
                        />
                    ))}
                    {/* Rear wheel */}
                    <circle cx="60" cy="110" r="28" fill="#1f2937" />
                    <circle cx="60" cy="110" r="20" fill="#374151" />
                    <circle cx="60" cy="110" r="10" fill="#6b7280" />
                    <circle cx="60" cy="110" r="5" fill="#9ca3af" />
                    {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                        <line key={i}
                            x1={60 + 10 * Math.cos(deg * Math.PI / 180)}
                            y1={110 + 10 * Math.sin(deg * Math.PI / 180)}
                            x2={60 + 19 * Math.cos(deg * Math.PI / 180)}
                            y2={110 + 19 * Math.sin(deg * Math.PI / 180)}
                            stroke="#9ca3af" strokeWidth="2.5"
                        />
                    ))}
                    {/* Wheel arches */}
                    <path d="M162 82 Q190 70 218 82" stroke="#c2410c" strokeWidth="5" fill="none" />
                    <path d="M32 82 Q60 70 88 82" stroke="#c2410c" strokeWidth="5" fill="none" />

                    {/* Undercarriage */}
                    <rect x="20" y="98" width="205" height="8" rx="4" fill="#374151" />
                    {/* Bumper */}
                    <rect x="210" y="88" width="20" height="18" rx="4" fill="#1f2937" />
                </g>

                {/* ====== BROKEN-DOWN CAR (being towed, hoisted slightly) ====== */}
                <g transform="translate(320, 360)" filter="url(#softShadow)">
                    {/* Car body */}
                    <rect x="0" y="50" width="130" height="50" rx="8" fill="url(#carBody)" />
                    {/* Cabin */}
                    <path d="M18 50 Q25 18 55 15 L90 15 Q110 15 115 50 Z" fill="#818cf8" />
                    {/* Windows */}
                    <path d="M24 50 Q30 24 58 22 L85 22 Q100 22 108 50 Z" fill="#bfdbfe" opacity="0.8" />
                    <line x1="65" y1="22" x2="65" y2="50" stroke="#6366f1" strokeWidth="2" />
                    {/* Window glare */}
                    <path d="M26 50 Q31 28 48 26 L52 26 Q42 36 36 50 Z" fill="white" opacity="0.2" />

                    {/* Doors */}
                    <line x1="50" y1="50" x2="48" y2="98" stroke="#4f46e5" strokeWidth="2" />
                    <line x1="82" y1="50" x2="80" y2="98" stroke="#4f46e5" strokeWidth="2" />
                    {/* Door handles */}
                    <rect x="30" y="70" width="14" height="4" rx="2" fill="#4338ca" />
                    <rect x="88" y="70" width="14" height="4" rx="2" fill="#4338ca" />

                    {/* Headlights */}
                    <rect x="122" y="58" width="10" height="12" rx="3" fill="#fef9c3" opacity="0.7" />
                    {/* Tail lights - broken, dim */}
                    <rect x="-2" y="58" width="8" height="12" rx="3" fill="#ef4444" opacity="0.4" />

                    {/* Bonnet / hood */}
                    <rect x="100" y="55" width="32" height="20" rx="4" fill="#6366f1" />

                    {/* Exhaust smoke - car is broken! */}
                    <ellipse cx="-8" cy="80" rx="8" ry="5" fill="#9ca3af" opacity="0.3" />
                    <ellipse cx="-18" cy="76" rx="10" ry="7" fill="#6b7280" opacity="0.2" />
                    <ellipse cx="-28" cy="70" rx="13" ry="9" fill="#6b7280" opacity="0.12" />

                    {/* Warning triangle on road */}
                    <g transform="translate(-60, 58)">
                        <polygon points="18,0 36,32 0,32" fill="#ef4444" opacity="0.9" />
                        <polygon points="18,6 32,28 4,28" fill="#fef9c3" opacity="0.9" />
                        <text x="18" y="25" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#ef4444">!</text>
                    </g>

                    {/* Flat tyre indicator */}
                    {/* Front wheel (flat) */}
                    <ellipse cx="100" cy="104" rx="22" ry="14" fill="#1f2937" />
                    <ellipse cx="100" cy="104" rx="14" ry="8" fill="#374151" />
                    <circle cx="100" cy="104" r="5" fill="#6b7280" />
                    {/* Rear wheel */}
                    <circle cx="30" cy="104" r="22" fill="#1f2937" />
                    <circle cx="30" cy="104" r="15" fill="#374151" />
                    <circle cx="30" cy="104" r="6" fill="#6b7280" />
                    {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                        <line key={i}
                            x1={30 + 6 * Math.cos(deg * Math.PI / 180)}
                            y1={104 + 6 * Math.sin(deg * Math.PI / 180)}
                            x2={30 + 14 * Math.cos(deg * Math.PI / 180)}
                            y2={104 + 14 * Math.sin(deg * Math.PI / 180)}
                            stroke="#9ca3af" strokeWidth="2"
                        />
                    ))}
                    {/* Undercarriage */}
                    <rect x="8" y="95" width="118" height="7" rx="3" fill="#374151" />
                    {/* Bumpers */}
                    <rect x="-4" y="88" width="14" height="14" rx="3" fill="#4338ca" />
                    <rect x="120" y="88" width="14" height="14" rx="3" fill="#4338ca" />
                    {/* Roof rack */}
                    <rect x="25" y="12" width="80" height="4" rx="2" fill="#4338ca" opacity="0.5" />
                </g>

                {/* ====== MOTORCYCLE (parked left, with rider silhouette) ====== */}
                <g transform="translate(90, 420)">
                    {/* Rider shadow */}
                    <ellipse cx="60" cy="85" rx="25" ry="5" fill="black" opacity="0.25" />
                    {/* Rider body (silhouette) */}
                    <ellipse cx="58" cy="28" rx="11" ry="13" fill="#1e1b4b" />
                    {/* Helmet */}
                    <circle cx="58" cy="14" r="13" fill="#312e81" />
                    <path d="M47 14 Q47 22 58 24 Q69 22 69 14" fill="#4f46e5" opacity="0.7" />
                    {/* Visor */}
                    <path d="M49 10 Q58 6 67 10 Q67 17 58 17 Q49 17 49 10 Z" fill="#93c5fd" opacity="0.7" />
                    {/* Arms */}
                    <path d="M50 32 Q38 42 36 50" stroke="#1e1b4b" strokeWidth="8" strokeLinecap="round" fill="none" />
                    <path d="M66 32 Q78 42 80 50" stroke="#1e1b4b" strokeWidth="8" strokeLinecap="round" fill="none" />

                    {/* Motorcycle frame */}
                    <line x1="20" y1="62" x2="90" y2="58" stroke="#374151" strokeWidth="5" strokeLinecap="round" />
                    <line x1="20" y1="62" x2="18" y2="78" stroke="#374151" strokeWidth="4" strokeLinecap="round" />
                    <line x1="90" y1="58" x2="92" y2="78" stroke="#374151" strokeWidth="4" strokeLinecap="round" />
                    {/* Motorcycle body / tank */}
                    <path d="M30 42 Q40 30 65 32 Q82 34 85 52 L80 62 L25 62 Z" fill="url(#motoBody)" />
                    {/* Tank highlight */}
                    <path d="M36 40 Q44 32 60 34 Q70 36 72 44 L62 46 Z" fill="white" opacity="0.15" />
                    {/* Seat */}
                    <path d="M55 38 Q76 36 85 52 L80 56 Q60 54 50 54 Z" fill="#7f1d1d" />
                    {/* Exhaust pipe */}
                    <path d="M25 62 Q10 68 8 78" stroke="#374151" strokeWidth="4" strokeLinecap="round" fill="none" />
                    <ellipse cx="6" cy="79" rx="5" ry="3" fill="#4b5563" />
                    {/* Handlebars */}
                    <rect x="80" y="46" width="22" height="4" rx="2" fill="#374151" />
                    <rect x="99" y="42" width="5" height="12" rx="2" fill="#1f2937" />
                    {/* Headlight */}
                    <circle cx="105" cy="57" r="7" fill="#fef9c3" opacity="0.85" />
                    <circle cx="105" cy="57" r="4" fill="#fefce8" />

                    {/* Front wheel */}
                    <circle cx="95" cy="78" r="22" fill="#1f2937" />
                    <circle cx="95" cy="78" r="15" fill="#374151" />
                    <circle cx="95" cy="78" r="6" fill="#6b7280" />
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
                        <line key={i}
                            x1={95 + 6 * Math.cos(deg * Math.PI / 180)}
                            y1={78 + 6 * Math.sin(deg * Math.PI / 180)}
                            x2={95 + 14 * Math.cos(deg * Math.PI / 180)}
                            y2={78 + 14 * Math.sin(deg * Math.PI / 180)}
                            stroke="#9ca3af" strokeWidth="1.5"
                        />
                    ))}
                    {/* Rear wheel */}
                    <circle cx="18" cy="78" r="22" fill="#1f2937" />
                    <circle cx="18" cy="78" r="15" fill="#374151" />
                    <circle cx="18" cy="78" r="6" fill="#6b7280" />
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
                        <line key={i}
                            x1={18 + 6 * Math.cos(deg * Math.PI / 180)}
                            y1={78 + 6 * Math.sin(deg * Math.PI / 180)}
                            x2={18 + 14 * Math.cos(deg * Math.PI / 180)}
                            y2={78 + 14 * Math.sin(deg * Math.PI / 180)}
                            stroke="#9ca3af" strokeWidth="1.5"
                        />
                    ))}
                    {/* Chain guard */}
                    <path d="M20 72 Q56 68 92 72" stroke="#4b5563" strokeWidth="3" fill="none" />
                    {/* Stand */}
                    <line x1="28" y1="72" x2="22" y2="90" stroke="#374151" strokeWidth="3" strokeLinecap="round" />
                </g>

                {/* ====== ROAD CONES ====== */}
                {[
                    { x: 310, y: 460 },
                    { x: 340, y: 468 },
                    { x: 370, y: 472 },
                ].map((pos, i) => (
                    <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
                        <polygon points="0,0 6,-24 12,0" fill="#f97316" opacity="0.9" />
                        <rect x="-1" y="-10" width="14" height="3" rx="1" fill="white" opacity="0.9" />
                        <rect x="-2" y="0" width="16" height="3" rx="1" fill="#374151" opacity="0.7" />
                    </g>
                ))}

                {/* ====== ROAD REFLECTION / WET ROAD ====== */}
                <rect x="380" y="480" width="320" height="80" fill="#312e81" opacity="0.08" rx="4" />

                {/* Tool kit / toolbox on road */}
                <g transform="translate(280, 452)">
                    <rect x="0" y="0" width="28" height="18" rx="4" fill="#d97706" />
                    <rect x="8" y="-6" width="12" height="8" rx="2" fill="#b45309" />
                    <line x1="0" y1="8" x2="28" y2="8" stroke="#b45309" strokeWidth="1.5" />
                </g>

                {/* ====== DISTANCE SIGN ====== */}
                <g transform="translate(730, 390)">
                    <rect x="0" y="0" width="55" height="30" rx="5" fill="#1e293b" />
                    <rect x="2" y="2" width="51" height="26" rx="4" fill="#0f172a" />
                    <text x="28" y="14" textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="monospace">CỨU HỘ</text>
                    <text x="28" y="24" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#f97316" fontFamily="monospace">24/7</text>
                    <rect x="25" y="30" width="5" height="20" rx="2" fill="#1e293b" />
                </g>

                {/* ====== FLOATING BADGE - app branding ====== */}
                <g transform="translate(310, 170)">
                    <rect x="0" y="0" width="180" height="65" rx="16" fill="#1e1b4b" opacity="0.85" />
                    <rect x="1" y="1" width="178" height="63" rx="15" fill="none" stroke="#6366f1" strokeWidth="1.5" opacity="0.6" />

                    {/* Shield icon */}
                    <path d="M22 20 L22 38 Q22 45 32 48 Q42 45 42 38 L42 20 L32 18 Z" fill="#f97316" />
                    <path d="M27 32 L30 35 L37 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

                    <text x="55" y="30" fontSize="13" fontWeight="bold" fill="white" fontFamily="Lexend, sans-serif">Rescue Me</text>
                    <text x="55" y="45" fontSize="9" fill="#94a3b8" fontFamily="Lexend, sans-serif">Cứu hộ 24/7 · Nhanh &amp; Tin cậy</text>

                    {/* Online dot */}
                    <circle cx="154" cy="16" r="5" fill="#22c55e" />
                    <circle cx="154" cy="16" r="8" fill="#22c55e" opacity="0.25" />
                </g>

                {/* Floating stat cards */}
                <g transform="translate(80, 180)">
                    <rect x="0" y="0" width="140" height="55" rx="14" fill="#1e1b4b" opacity="0.8" />
                    <rect x="1" y="1" width="138" height="53" rx="13" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.5" />
                    <text x="16" y="22" fontSize="9" fill="#94a3b8" fontFamily="Lexend, sans-serif">Đã cứu hộ thành công</text>
                    <text x="16" y="40" fontSize="18" fontWeight="bold" fill="#f97316" fontFamily="Lexend, sans-serif">12,847</text>
                    <text x="108" y="40" fontSize="9" fill="#22c55e" fontFamily="Lexend, sans-serif">+8%</text>
                    {/* Chart bars mini */}
                    {[22, 30, 18, 35, 28, 40].map((h, i) => (
                        <rect key={i} x={66 + i * 9} y={52 - h * 0.4} width="6" height={h * 0.4} rx="2" fill="#f97316" opacity={0.3 + i * 0.12} />
                    ))}
                </g>

                <g transform="translate(575, 175)">
                    <rect x="0" y="0" width="130" height="55" rx="14" fill="#1e1b4b" opacity="0.8" />
                    <rect x="1" y="1" width="128" height="53" rx="13" fill="none" stroke="#6366f1" strokeWidth="1" opacity="0.5" />
                    <text x="14" y="22" fontSize="9" fill="#94a3b8" fontFamily="Lexend, sans-serif">Thời gian phản hồi</text>
                    <text x="14" y="40" fontSize="18" fontWeight="bold" fill="#6366f1" fontFamily="Lexend, sans-serif">&lt; 8 phút</text>
                    {/* Clock icon */}
                    <circle cx="112" cy="30" r="14" fill="#312e81" opacity="0.7" />
                    <circle cx="112" cy="30" r="10" fill="none" stroke="#6366f1" strokeWidth="1.5" />
                    <line x1="112" y1="30" x2="112" y2="23" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
                    <line x1="112" y1="30" x2="117" y2="33" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
                </g>

                {/* ====== ROAD REFLECTION on wet road (shimmer) ====== */}
                <rect x="0" y="455" width="800" height="3" fill="white" opacity="0.05" />

            </g>
        </svg>
    );
}
