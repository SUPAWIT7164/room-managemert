const ldap = require('ldapjs');

function isLdapEnabled() {
    return Boolean(
        process.env.LDAP_SERVER &&
        process.env.LDAP_DOMAIN &&
        process.env.LDAP_PORT
    );
}

function parseBaseOUs() {
    const raw = String(process.env.LDAP_BASE_OUS || '').trim();
    if (!raw) return [];
    return raw
        .replace(/^"+|"+$/g, '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
}

function normalizeUsername(username) {
    const raw = String(username || '').trim();
    if (!raw) return '';
    if (raw.includes('@')) return raw.split('@')[0];
    return raw;
}

function makeBindUser(username) {
    const raw = String(username || '').trim();
    const domain = String(process.env.LDAP_DOMAIN || '').trim();
    if (!raw) return '';
    if (raw.includes('@')) return raw;
    return `${raw}@${domain}`;
}

function createClient() {
    const host = String(process.env.LDAP_SERVER || '').trim();
    const port = String(process.env.LDAP_PORT || '389').trim();
    return ldap.createClient({
        url: `ldap://${host}:${port}`,
        timeout: Number(process.env.LDAP_TIMEOUT_MS || 8000),
        connectTimeout: Number(process.env.LDAP_CONNECT_TIMEOUT_MS || 8000),
        reconnect: false,
    });
}

async function bindAsync(client, dn, password) {
    return new Promise((resolve, reject) => {
        client.bind(dn, password, (err) => (err ? reject(err) : resolve()));
    });
}

async function unbindAsync(client) {
    return new Promise((resolve) => {
        client.unbind(() => resolve());
    });
}

async function searchOneInBase(client, base, username) {
    const normalized = normalizeUsername(username);
    const login = String(username || '').trim();
    const filter = `(|(sAMAccountName=${normalized})(userPrincipalName=${login})(mail=${login}))`;
    const opts = {
        scope: 'sub',
        filter,
        sizeLimit: 1,
        attributes: [
            'cn',
            'displayName',
            'mail',
            'sAMAccountName',
            'employeeID',
            'department',
            'telephoneNumber',
            'title',
        ],
    };

    return new Promise((resolve, reject) => {
        client.search(base, opts, (err, res) => {
            if (err) return reject(err);
            let entry = null;
            res.on('searchEntry', (e) => {
                if (!entry) entry = e.object || null;
            });
            res.on('error', (e) => reject(e));
            res.on('end', () => resolve(entry));
        });
    });
}

async function getUserProfile(client, username) {
    const bases = parseBaseOUs();
    if (!bases.length) return null;

    for (const base of bases) {
        try {
            const found = await searchOneInBase(client, base, username);
            if (found) return found;
        } catch (err) {
            console.warn('[LDAP] Search failed on base', base, err.message);
        }
    }
    return null;
}

async function authenticate(username, password) {
    if (!isLdapEnabled()) {
        return { success: false, reason: 'ldap_not_configured' };
    }
    const pwd = String(password || '');
    const user = String(username || '').trim();
    if (!user || !pwd) {
        return { success: false, reason: 'missing_credentials' };
    }

    const client = createClient();
    try {
        const bindUser = makeBindUser(user);
        await bindAsync(client, bindUser, pwd);
        const profile = await getUserProfile(client, user);

        return {
            success: true,
            user: {
                username: normalizeUsername(profile?.sAMAccountName || user),
                name: profile?.displayName || profile?.cn || normalizeUsername(user),
                email: profile?.mail || (user.includes('@') ? user : null),
                employeeId: profile?.employeeID || normalizeUsername(user),
                department: profile?.department || null,
                phone: profile?.telephoneNumber || null,
                position: profile?.title || null,
            },
        };
    } catch (error) {
        return { success: false, reason: 'invalid_credentials', error };
    } finally {
        await unbindAsync(client);
    }
}

module.exports = {
    isLdapEnabled,
    authenticate,
};
