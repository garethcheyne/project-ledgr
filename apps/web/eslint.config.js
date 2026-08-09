import { base, noDatabaseAccess } from "@ledgr/config/eslint";

// noDatabaseAccess enforces ADR 0002: the web app is a client of the Core API,
// never of the database. If this rule fires, add an API endpoint — don't add an
// exception.
export default [...base, noDatabaseAccess, { ignores: [".next/**"] }];
