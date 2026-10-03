// Unbiased Fisher–Yates shuffle. Returns a new array; the input is untouched.
// (`sort(() => Math.random() - 0.5)` is not a substitute — it skews the
// resulting order and its bias depends on the engine's sort algorithm.)
export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
