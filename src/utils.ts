import fs from 'fs'

export const WORKER_ACCOUNTS: string[] = getJSON(
    'assets/workers.json'
)

export function findAccount(account: string) {
    for (const whitelistAccount of WORKER_ACCOUNTS) {
        if (whitelistAccount.toString().toLowerCase() === account.toString().toLowerCase()) {
            return true;
        }
    }
    return false;
}

export function getJSON(filename: string) {
    const data = fs.readFileSync(filename).toString()
    return JSON.parse(data)
}
