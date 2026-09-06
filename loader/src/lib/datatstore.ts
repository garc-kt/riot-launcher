import { exists, readBinaryFile, writeBinaryFile } from '@tauri-apps/api/fs'
import { Config } from './config'

export const DataStore = new class {

    async json(): Promise<Record<string, any>> {
        const path = await Config.basePath('datastore')
        if (await exists(path)) {
            try {
                const data = await readBinaryFile(path)
                this.transform(data)
                return this.decode(data)
            } catch {
            }
        }
        return {}
    }

    async get<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
        const store = await this.json()
        return (store && key in store) ? (store[key] as T) : defaultValue
    }

    async set(key: string, value: any): Promise<boolean> {
        const store = await this.json()
        store[key] = value
        return this.save(store)
    }

    async save(store: Record<string, any>): Promise<boolean> {
        try {
            const path = await Config.basePath('datastore')
            const jsonStr = JSON.stringify(store)
            const encoder = new TextEncoder()
            const bytes = encoder.encode(jsonStr)
            this.transform(bytes)
            await writeBinaryFile(path, bytes)
            return true
        } catch (err) {
            console.warn('Failed to save datastore:', err)
            return false
        }
    }

    private decode(data: Uint8Array): Record<string, any> {
        if (data.length >= 2) {
            try {
                const decoder = new TextDecoder()
                const text = decoder.decode(data)
                return JSON.parse(text)
            } catch {
                return {}
            }
        } else {
            return {}
        }
    }

    private transform(data: Uint8Array) {
        const key = 'A5dgY6lz9fpG9kGNiH1mZ'
        for (let i = 0; i < data.length; i++) {
            data[i] ^= key.charCodeAt(i % key.length)
        }
    }
}