import { SquareClient, SquareEnvironment } from 'square';

let client: SquareClient | null = null;

export function getSquareClient() {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;

    if (!accessToken) {
        console.warn('SQUARE_ACCESS_TOKEN not set');
        return null;
    }

    if (!client) {
        client = new SquareClient({
            token: accessToken,
            environment: SquareEnvironment.Production,
        });
    }

    return client;
}
