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
            /** Mapbox-style: custom DOM must use `{ element }` — plain `HTMLElement` is not always applied as marker content. */
            Marker: new (
                options?:
                    | HTMLElement
                    | {
                          element?: HTMLElement;
                          anchor?: string;
                          color?: string;
                          scale?: number;
                          draggable?: boolean;
                      }
            ) => {
                setLngLat: (lngLat: [number, number]) => any;
                addTo: (map: any) => any;
                remove: () => void;
            };
            Popup: new (options?: {
                closeButton?: boolean;
                closeOnClick?: boolean;
                offset?: number;
                maxWidth?: string;
            }) => {
                setLngLat: (lngLat: [number, number]) => any;
                setHTML: (html: string) => any;
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
