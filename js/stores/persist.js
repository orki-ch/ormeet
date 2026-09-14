const { reactive, watch } = Vue

// Reaktiven State anlegen, aus localStorage laden und bei jeder Änderung zurückschreiben
export function persistentState(key, standard) {
  const state = reactive(JSON.parse(localStorage.getItem(key)) || standard)
  watch(state, () => localStorage.setItem(key, JSON.stringify(state)))
  return state
}
