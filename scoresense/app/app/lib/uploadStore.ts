"use client"

/**
 * IndexedDB-backed storage for user-uploaded piece files. localStorage can't
 * hold binary blobs at any real scale, so uploads that should survive a
 * reload/return-visit (the "My Uploads" library section) live here instead.
 */

const DB_NAME = "scoresense-uploads"
const DB_VERSION = 1
const STORE_NAME = "files"

export interface UploadRecord {
  id: string
  name: string
  size: number
  addedAt: string
}

interface StoredFile extends UploadRecord {
  blob: Blob
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Stable id from name+size+lastModified so re-uploading the same file reuses the same entry. */
function idFor(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`
}

export async function saveUpload(file: File): Promise<string> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return idFor(file)
  const id = idFor(file)
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const record: StoredFile = { id, name: file.name, size: file.size, addedAt: new Date().toISOString(), blob: file }
    tx.objectStore(STORE_NAME).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return id
}

export async function listUploads(): Promise<UploadRecord[]> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return []
  const db = await openDb()
  const records = await new Promise<StoredFile[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result as StoredFile[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return records
    .map(({ id, name, size, addedAt }) => ({ id, name, size, addedAt }))
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
}

export async function getUploadBlob(id: string): Promise<Blob | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null
  const db = await openDb()
  const record = await new Promise<StoredFile | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve(req.result as StoredFile | undefined)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return record?.blob ?? null
}

export async function deleteUpload(id: string): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
