import admin from 'firebase-admin'

admin.initializeApp()

const auth = admin.auth()
const db   = admin.firestore()
const KEEP = 'gh@gh.com'

async function getAllUsers() {
  const users = []
  let pageToken
  do {
    const result = await auth.listUsers(1000, pageToken)
    users.push(...result.users)
    pageToken = result.pageToken
  } while (pageToken)
  return users
}

async function main() {
  const all      = await getAllUsers()
  const toDelete = all.filter(u => u.email !== KEEP)

  console.log(`Keeping: ${KEEP}`)
  console.log(`Deleting ${toDelete.length} of ${all.length} total accounts`)

  if (!toDelete.length) {
    console.log('Nothing to do.')
    return
  }

  // 1. Delete Auth records (max 1000 per call)
  const uids = toDelete.map(u => u.uid)
  for (let i = 0; i < uids.length; i += 1000) {
    const res = await auth.deleteUsers(uids.slice(i, i + 1000))
    console.log(`Auth: deleted ${res.successCount}, failed ${res.failureCount}`)
    res.errors.forEach(e => console.error(`  Failed uid index ${e.index}:`, e.error.message))
  }

  // 2. Delete Firestore trees (users/{uid} + all subcollections)
  for (const uid of uids) {
    await db.recursiveDelete(db.doc(`users/${uid}`))
    console.log(`Firestore cleaned: ${uid}`)
  }

  console.log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
