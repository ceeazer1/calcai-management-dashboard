import { SquareClient, SquareEnvironment } from 'square';

let client: SquareClient | null = null;

export function getSquareClient() {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const environment = process.env.SQUARE_ENVIRONMENT || 'production';

    if (!accessToken) {
        console.warn('SQUARE_ACCESS_TOKEN not set');
        return null;
    }

    if (!client) {
        client = new SquareClient({
            token: accessToken,
            environment: environment === 'sandbox' ? SquareEnvironment.Sandbox : SquareEnvironment.Production,
        });
    }

    return client;
}
