import { httpsCallable } from 'firebase/functions'
import { doc, getDoc } from 'firebase/firestore'
import { functions, db } from './firebase'

const callCreateCheckout     = httpsCallable(functions, 'createStripeCheckout')
const callBillingPortal      = httpsCallable(functions, 'createStripeBillingPortal')
const callPurchaseTryOnPack  = httpsCallable(functions, 'purchaseTryOnPack')

export async function createCheckoutSession(uid, plan = 'monthly') {
  const { data } = await callCreateCheckout({ plan })
  if (data.url) window.location.href = data.url
}

export async function openBillingPortal() {
  const { data } = await callBillingPortal({})
  if (data.url) window.location.href = data.url
}

export async function purchaseTryOnPackSession() {
  const { data } = await callPurchaseTryOnPack({})
  if (data.url) window.location.href = data.url
}

export async function loadUsage(uid) {
  const snap = await getDoc(doc(db, `users/${uid}/prefs/usage`))
  return snap.exists() ? snap.data() : {}
}

export async function loadSubscription(uid) {
  const snap = await getDoc(doc(db, `users/${uid}/prefs/subscription`))
  return snap.exists() ? snap.data() : null
}
