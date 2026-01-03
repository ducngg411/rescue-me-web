// VietMap types
declare global {
    interface Window {
        vietmapgl?: {
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
