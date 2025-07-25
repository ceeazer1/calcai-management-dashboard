import { generatePasswordHash } from './auth.mjs';

// Generate password hash for your custom password
const password = process.argv[2];

if (!password) {
    console.log('Usage: node generate-password.mjs <your-password>');
    console.log('Example: node generate-password.mjs mySecurePassword123');
    process.exit(1);
}

generatePasswordHash(password).then(hash => {
    console.log('\n=== CalcAI Dashboard Password Setup ===');
    console.log('Password:', password);
    console.log('Hash:', hash);
    console.log('\nTo use this password, set the environment variable:');
    console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
    console.log('\nOr update the auth.mjs file with this hash.');
    console.log('=====================================\n');
}).catch(error => {
    console.error('Error generating hash:', error);
});
