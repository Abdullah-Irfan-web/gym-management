import bcrypt from "bcryptjs";
const pw = process.argv[2];
if (!pw || pw.length < 10) { console.error('Usage: npm run hash-password -- "a-password-of-10+-chars"'); process.exit(1); }
// Escape $ as \$ so Next.js env expansion doesn't mangle the hash in .env files
console.log(bcrypt.hashSync(pw, 12).replace(/\$/g, "\\$"));
