// VietMap types
declare global {
    interface Window {
        vietmapgl?: {
            Map: new (options: {
                container: HTMLElement | string;
                style: string;
                center: [number, number];
                zoom: number;
            }) => {
                addControl: (control: any, position?: string) => void;
                on: (event: string, callback: (e: any) => void) => void;
                flyTo: (options: {
                    center: [number, number];
                    zoom: number;
                    duration: number;
                }) => void;
                remove: () => void;
            };
            Marker: new (element?: HTMLElement) => {
                setLngLat: (lngLat: [number, number]) => any;
                addTo: (map: any) => any;
                remove: () => void;
            };
            NavigationControl: new () => any;
            PlaceAutocomplete: new (options: {
                container: HTMLElement;
                apiKey: string;
            }) => {
                on: (event: string, callback: (e: any) => void) => void;
            };
        };
    }
}

export { };
