import {
  reactive,
  ref,
  watch
} from 'vue'

const STORAGE_KEY = 'bps-dashboard.filters.v1'

function readStoredFilters() {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || '{}'
    )

    return stored && typeof stored === 'object' && !Array.isArray(stored)
      ? stored
      : {}
  } catch {
    return {}
  }
}

function writeStoredFilters(update) {
  if (typeof window === 'undefined') {
    return
  }

  const stored = readStoredFilters()
  update(stored)

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(stored)
    )
  } catch {
    // Storage can be unavailable or full; in-memory filters still work.
  }
}

function sanitizeValue(value, fallback) {
  if (Array.isArray(fallback)) {
    return Array.isArray(value)
      ? value.filter(item =>
          typeof item === 'string' || typeof item === 'number'
        )
      : [...fallback]
  }

  return typeof value === typeof fallback
    ? value
    : fallback
}

const storedAtStartup = readStoredFilters()
const storedSharedFilters =
  storedAtStartup.sharedFilters &&
  typeof storedAtStartup.sharedFilters === 'object' &&
  !Array.isArray(storedAtStartup.sharedFilters)
    ? storedAtStartup.sharedFilters
    : {}

const sharedFilters = reactive({
  ...storedSharedFilters
})

watch(
  sharedFilters,
  value => {
    writeStoredFilters(stored => {
      stored.sharedFilters = { ...value }
    })
  },
  { deep: true }
)

const globalSector = ref(
  Array.isArray(storedAtStartup.globalSector) &&
  storedAtStartup.globalSector.every(item =>
    typeof item === 'string' || typeof item === 'number'
  )
    ? storedAtStartup.globalSector
    : null
)

watch(
  globalSector,
  value => {
    writeStoredFilters(stored => {
      if (value === null) {
        delete stored.globalSector
      } else {
        stored.globalSector = [...value]
      }
    })
  },
  { deep: true }
)

export function setSharedFilter(key, value) {
  const nextValue = Array.isArray(value)
    ? [...value]
    : value

  if (
    JSON.stringify(sharedFilters[key]) ===
    JSON.stringify(nextValue)
  ) {
    return
  }

  sharedFilters[key] = nextValue
}

export function clearSharedFilter(key) {
  if (!Object.hasOwn(sharedFilters, key)) {
    return
  }

  delete sharedFilters[key]
}

export function publishChangedFilters(previous, current, keys) {
  if (previous) {
    for (const key of keys) {
      if (
        JSON.stringify(previous[key]) !==
        JSON.stringify(current[key])
      ) {
        setSharedFilter(key, current[key])
      }
    }
  }

  return JSON.parse(JSON.stringify(current))
}

export function usePersistentFilterState(page, defaults, sharedKeys = {}) {
  const storedAtCall = readStoredFilters()
  const savedPage = storedAtCall.pages?.[page]
  const hasSavedState =
    savedPage && typeof savedPage === 'object' && !Array.isArray(savedPage)

  const state = reactive(
    Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => [
        key,
        sanitizeValue(savedPage?.[key], fallback)
      ])
    )
  )

  for (const [localKey, sharedKey] of Object.entries(sharedKeys)) {
    if (
      Object.hasOwn(sharedFilters, sharedKey) &&
      Object.hasOwn(defaults, localKey)
    ) {
      state[localKey] = sanitizeValue(
        sharedFilters[sharedKey],
        defaults[localKey]
      )
    }
  }

  const sharedSector =
    globalSector.value !== null
      ? [...globalSector.value]
      : null

  const hasSharedState =
    Object.values(sharedKeys).some(sharedKey =>
      Object.hasOwn(sharedFilters, sharedKey)
    ) || sharedSector !== null

  const sectorKey =
    Object.hasOwn(defaults, 'sektor')
      ? 'sektor'
      : Object.hasOwn(defaults, 'institusi')
        ? 'institusi'
        : null

  if (sectorKey && sharedSector !== null) {
    state[sectorKey] = sharedSector
  }

  watch(
    state,
    value => {
      writeStoredFilters(stored => {
        const savedPage = stored.pages?.[page] || {}

        stored.pages = {
          ...(stored.pages || {}),
          [page]: {
            ...savedPage,
            ...value
          }
        }
      })
    },
    { deep: true }
  )

  if (sectorKey) {
    watch(
      () => state[sectorKey],
      value => {
        globalSector.value = [...value]
      },
      { deep: true }
    )
  }

  return {
    state,
    hasSavedState: Boolean(hasSavedState || hasSharedState),
    hasGlobalSector: sharedSector !== null,
    sharedFilters
  }
}