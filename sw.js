// --- 全局常量与配置 ---

/**
 * @description 缓存存储的名称。更改此值将触发 Service Worker 的更新流程，并自动清理旧缓存。
 * @type {string}
 */
const CACHE_NAME = 'blog'

/**
 * @description 用于存储缓存元数据（如时间戳）的 IndexedDB 数据库名称。
 * @type {string}
 */
const DB_NAME = 'blog-cache-metadata'

/**
 * @description IndexedDB 中用于存储时间戳记录的对象存储空间（Object Store）名称。
 * @type {string}
 */
const STORE_NAME = 'timestamps'

/**
 * @description 缓存资源的过期天数。
 * @type {number}
 */
const EXPIRY_DAYS = 13

/**
 * @description 缓存过期天数对应的毫秒数。
 * @type {number}
 */
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000

/**
 * @description 后台网络请求的节流时间（毫秒）。
 * 在此时间内，对于同一个资源，即使缓存存在，也只会在后台发起一次网络请求进行更新。
 * @type {number}
 */
const BACKGROUND_FETCH_THROTTLE_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * @description 用于注册定期后台同步任务的唯一标签，专用于缓存清理。
 * @type {string}
 */
const PERIODIC_SYNC_TAG = `${CACHE_NAME}-cleanup`

/**
 * @description 需要在 Service Worker 安装时立即缓存的核心资源 (App Shell)。
 * @type {string[]}
 */
const PRECACHE_LIST = [
	'./',
	'./offline.html',
	'./js/jquery.min.js',
	'./js/bootstrap.min.js',
	'./js/hux-blog.min.js',
	'./js/snackbar.js',
	'./img/icon_wechat.png',
	'./img/home-bg.jpg',
	'./img/404-bg.jpg',
	'./css/hux-blog.min.css',
	'./css/bootstrap.min.css',
]

/**
 * @description 用于缓存 IndexedDB 数据库连接的 Promise。
 * 避免重复打开数据库，提高性能。当连接关闭或发生错误时，此变量将被重置为 null。
 * @type {Promise<IDBDatabase> | null}
 */
let dbPromise = null


// --- IndexedDB 辅助函数 ---

/**
 * @description 打开或创建 IndexedDB 数据库。
 * 此函数会缓存数据库连接的 Promise，以避免不必要的重复连接。
 * @returns {Promise<IDBDatabase>} 返回一个解析为 IndexedDB 数据库实例的 Promise。
 */
function openMetadataDB() {
	if (dbPromise) return dbPromise
	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1)
		request.onupgradeneeded = event => {
			const db = event.target.result
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' })
				store.createIndex('timestamp', 'timestamp', { unique: false })
			}
		}
		request.onsuccess = event => {
			const db = event.target.result
			db.onclose = () => { dbPromise = null }
			db.onerror = (e) => {
				console.error('[SW DB] Database error:', e.target.error)
				dbPromise = null
			}
			resolve(db)
		}
		request.onerror = event => {
			console.error('[SW DB] Database open error:', event.target.error)
			dbPromise = null
			reject(event.target.error)
		}
		request.onblocked = () => { console.warn('[SW DB] Database open blocked.') }
	})
	return dbPromise
}

/**
 * @description 封装一个通用的 IndexedDB 事务执行函数。
 * @param {IDBTransactionMode} mode - 事务模式，'readonly' 或 'readwrite'。
 * @param {(store: IDBObjectStore) => void} callback - 一个在事务上下文中执行的回调函数。
 * @returns {Promise<void>} 在事务成功完成时解析，在失败时拒绝。
 */
async function performTransaction(mode, callback) {
	try {
		const db = await openMetadataDB()
		const transaction = db.transaction(STORE_NAME, mode)
		const store = transaction.objectStore(STORE_NAME)
		callback(store)
		return new Promise((resolve, reject) => {
			transaction.oncomplete = () => resolve()
			transaction.onerror = () => reject(transaction.error)
		})
	} catch (error) {
		console.error(`[SW DB] Transaction failed with mode ${mode}:`, error)
		throw error
	}
}

/**
 * @description 向 IndexedDB 中更新或插入指定 URL 的时间戳。
 * @param {string} url - 资源的 URL。
 * @param {number} timestamp - 当前的时间戳。
 * @returns {Promise<void>}
 */
async function updateTimestamp(url, timestamp) {
	try {
		await performTransaction('readwrite', store => store.put({ url, timestamp }))
	} catch (error) { /* 错误已在 performTransaction 中记录 */ }
}

/**
 * @description 从 IndexedDB 中获取指定 URL 的时间戳。
 * @param {string} url - 资源的 URL。
 * @returns {Promise<number | null>} 返回找到的时间戳，或 null。
 */
async function getTimestamp(url) {
	let timestamp = null
	try {
		await performTransaction('readonly', store => {
			const request = store.get(url)
			request.onsuccess = () => {
				if (request.result) timestamp = request.result.timestamp
			}
		})
		return timestamp
	} catch (error) {
		return null
	}
}

/**
 * @description 清理过期的缓存和 IndexedDB 中的元数据。
 * @returns {Promise<void>}
 */
async function cleanupExpiredCache() {
	const now = Date.now()
	const expiryThreshold = now - EXPIRY_MS
	const urlsToDelete = []

	try {
		await performTransaction('readwrite', store => {
			const index = store.index('timestamp')
			const range = IDBKeyRange.upperBound(expiryThreshold)
			index.openCursor(range).onsuccess = event => {
				const cursor = event.target.result
				if (cursor) {
					urlsToDelete.push(cursor.value.url)
					cursor.delete()
					cursor.continue()
				}
			}
		})

		if (urlsToDelete.length > 0) {
			console.log(`[SW Cleanup] Deleting ${urlsToDelete.length} expired items.`)
			const cache = await caches.open(CACHE_NAME)
			await Promise.all(urlsToDelete.map(url => cache.delete(url)))
		} else
			console.log('[SW Cleanup] No expired items to clean up.')

	} catch (error) {
		console.error('[SW Cleanup] Cache cleanup process failed:', error)
	}
}


// --- Fetch 辅助函数 ---

/**
 * 清理响应对象，使其符合傻逼Chrome的脑残规范。
 * @param {Response} response - 响应对象。
 * @returns {Promise<Response>} 返回一个符合规范的响应对象。
 */
function cleanResponse(response) {
	return Promise.resolve('body' in response ?
		response.body :
		response.blob()
	).then((body) => new Response(body, {
			headers: response.headers,
			status: response.status,
			statusText: response.statusText,
		})
	)
}

/**
 * @description 获取资源并智能地处理缓存和重定向。
 * **此实现包含 HEAD 请求预检 CORS 的关键逻辑**。
 * @param {Request} request - 要获取和缓存的请求。
 * @returns {Promise<Response>} 返回一个适合直接响应给浏览器的 Response 对象。
 */
async function fetchAndCache(request) {
	try {
		const cache = await caches.open(CACHE_NAME)
		let error, networkResponse = await fetch(request).catch(_ => { error = _ })
		if (networkResponse?.type === 'opaque' || !networkResponse?.ok) {
			const cachedResponse = await cache.match(request)
			const can_cors = cachedResponse ? cachedResponse.headers.get('Access-Control-Allow-Origin') : new URL(request.url).origin !== self.location.origin && await fetch(request.url, { method: 'HEAD' }).then(response => response.headers.get('Access-Control-Allow-Origin')).catch(_ => null)
			const newNetworkResponse = await fetch(request.url, { ...request, mode: can_cors ? 'cors' : request.mode === 'no-cors' ? 'no-cors' : undefined, url: undefined }).catch(_ => { error = _ })
			if (newNetworkResponse?.ok) networkResponse = newNetworkResponse
			else if (error) throw error
		}

		if (networkResponse && networkResponse.ok && networkResponse.type !== 'opaque') {
			const cache = await caches.open(CACHE_NAME)
			const responseToCache = networkResponse.clone()
			const now = Date.now()

			if (networkResponse.redirected) {
				await cache.put(networkResponse.url, await cleanResponse(responseToCache))
				await updateTimestamp(networkResponse.url, now)
				const redirectResponse = Response.redirect(networkResponse.url, 302)
				await cache.put(request, await cleanResponse(redirectResponse.clone()))
				await updateTimestamp(request.url, now)
				return redirectResponse
			} else {
				await cache.put(request, responseToCache)
				await updateTimestamp(request.url, now)
			}
		} else if (networkResponse && networkResponse.type !== 'opaque')
			console.warn(`[SW ${CACHE_NAME}] Fetch for ${request.url} responded with ${networkResponse.status}. Not caching.`)


		return networkResponse
	} catch (error) {
		console.error(`[SW ${CACHE_NAME}] fetchAndCache failed for ${request.url}:`, error)
		throw error
	}
}


// --- 客户端通信与内容校验 ---

/**
 * @description 向所有客户端广播消息。
 * @param {any} msg - 要发送的消息对象。
 */
function sendMessageToAllClients(msg) {
	self.clients.matchAll().then(clients => {
		clients.forEach(client => client.postMessage(msg))
	})
}

/**
 * @description 校验内容更新，如果发现更新则通知客户端。
 * @param {Request} request - 原始请求。
 * @param {Response} networkResponse - 从网络获取的新响应。
 * @returns {Promise<void>}
 */
async function revalidateAndNotify(request, networkResponse) {
	try {
		const cache = await caches.open(CACHE_NAME)
		const cachedResponse = await cache.match(request)

		if (!cachedResponse || !networkResponse?.ok) return

		const cachedVer = cachedResponse.headers.get('last-modified')
		const fetchedVer = networkResponse.headers.get('last-modified')

		if (cachedVer && fetchedVer && cachedVer !== fetchedVer) {
			console.log(`[SW Revalidate] Content updated for ${request.url}. Notifying client.`)
			sendMessageToAllClients({ 'command': 'UPDATE_FOUND', 'url': request.url })
		}
	} catch (error) {
		console.error('[SW Revalidate] Error during content revalidation:', error)
	}
}


// --- 缓存策略 ---

/**
 * @description 缓存优先策略（Cache-First），结合后台节流更新 (Stale-While-Revalidate)。
 * @param {Request} request - fetch 事件中的请求对象。
 * @returns {Promise<Response>}
 */
async function handleCacheFirst(request) {
	const cache = await caches.open(CACHE_NAME)
	const cachedResponse = await cache.match(request, { ignoreVary: true })

	const now = Date.now()
	const storedTimestamp = await getTimestamp(request.url)
	const isThrottled = storedTimestamp && (now - storedTimestamp < BACKGROUND_FETCH_THROTTLE_MS)

	const backgroundUpdateTask = async () => {
		if (isThrottled) return
		try {
			await fetchAndCache(request.clone())
		} catch (error) { /* 错误已在 fetchAndCache 中记录 */ }
	}

	if (cachedResponse) {
		backgroundUpdateTask() // 非阻塞执行
		return cachedResponse
	}

	return fetchAndCache(request)
}

/**
 * @description 网络优先策略（Network-First），结合内容更新通知，并内置离线回退。
 * @param {Request} request - fetch 事件中的请求对象。
 * @returns {Promise<Response>}
 */
async function handleNetworkFirst(request) {
	try {
		// 优先尝试网络请求
		const networkResponse = await fetchAndCache(request.clone())

		if (isNavigationReq(request))
			revalidateAndNotify(request, networkResponse.clone()) // 非阻塞地检查内容更新

		return networkResponse
	} catch (error) {
		// 网络请求失败，进入回退逻辑
		console.warn(`[SW ${CACHE_NAME}] Network fetch failed for ${request.url}. Trying cache.`, error)
		const cache = await caches.open(CACHE_NAME)
		const cachedResponse = await cache.match(request, { ignoreVary: true })

		// 如果缓存中有，则返回缓存的响应
		if (cachedResponse) {
			console.log(`[SW ${CACHE_NAME}] Serving from cache as fallback: ${request.url}`)
			return cachedResponse
		}

		// 如果缓存中也没有，并且这是一个页面导航请求，则返回统一的离线页面
		if (isNavigationReq(request)) {
			console.log(`[SW ${CACHE_NAME}] Network and cache failed for navigation. Serving offline page.`)
			const offlinePage = await cache.match('./offline.html')
			// 确保 offline.html 已经被缓存
			if (offlinePage) return offlinePage
		}
		throw error
	}
}


// --- 路由辅助函数 ---

const isNavigationReq = (req) => req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))

// --- 路由表 ---

let coldBootMode = false

self.addEventListener('message', event => {
	if (event.data?.type === 'EXIT_COLD_BOOT') {
		const wasColdBoot = coldBootMode
		coldBootMode = false
		console.log('[SW] Exited cold boot mode.')
		if (event.ports[0]) event.ports[0].postMessage({ wasColdBoot })
	}
	else if (event.data?.type === 'ENTER_COLD_BOOT') {
		coldBootMode = true
		console.log('[SW] Entered cold boot mode.')
	}
})

/**
 * @description 使用路由表管理请求处理逻辑。
 * @type {Array<{condition: (context: {request: Request, url: URL}) => boolean, handler: (context: {request: Request}) => Promise<Response> | Response | null}>}
 */
const routes = [// 忽略无缓存请求。
	{ condition: ({ request }) => request.cache === 'no-store', handler: () => null },
	{ condition: ({ request }) => request.method !== 'GET', handler: () => null },
	{ condition: ({ url }) => !url.protocol.startsWith('http'), handler: () => null },
	// 冷启动模式：优先使用缓存
	{
		condition: ({ url }) => {
			if (url.searchParams.get('cold_bootting') === 'true') coldBootMode = true
			return coldBootMode
		},
		handler: ({ event, url }) => {
			if (url.searchParams.has('cold_bootting')) {
				const cleanUrl = new URL(url)
				cleanUrl.searchParams.delete('cold_bootting')
				const { mode, ...rest } = event.request
				const cleanRequest = new Request(cleanUrl, {
					...rest,
					mode: mode === 'navigate' ? 'same-origin' : mode,
				})
				return handleCacheFirst(cleanRequest)
			}
			return handleCacheFirst(event.request)
		},
	},
	{ condition: ({ request }) => request.cache === 'no-cache', handler: ({ request }) => handleNetworkFirst(request) },
	{ condition: ({ url }) => url.origin !== self.location.origin, handler: ({ request }) => handleCacheFirst(request) },
	{ condition: () => true, handler: ({ request }) => handleNetworkFirst(request) },
]


// --- Service Worker 事件监听器 ---

self.addEventListener('install', event => {
	console.log(`[SW ${CACHE_NAME}] Installing...`)
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME)
			await cache.addAll(PRECACHE_LIST)
			await self.skipWaiting()
		})(),
	)
})

self.addEventListener('activate', event => {
	console.log(`[SW ${CACHE_NAME}] Activating...`)
	event.waitUntil(
		(async () => {
			// 自动清理所有不匹配当前 CACHE_NAME 的旧缓存
			const cacheNames = await caches.keys()
			await Promise.all(
				cacheNames
					.filter(name => name !== CACHE_NAME)
					.map(name => {
						console.log(`[SW ${CACHE_NAME}] Deleting old cache: ${name}`)
						return caches.delete(name)
					}),
			)

			if ('periodicSync' in self.registration)
				try {
					await self.registration.periodicSync.register(PERIODIC_SYNC_TAG, { minInterval: 24 * 60 * 60 * 1000 })
				} catch (err) { console.error('[SW] Periodic sync registration failed:', err) }


			await self.clients.claim()
			await cleanupExpiredCache()
		})(),
	)
})

self.addEventListener('periodicsync', event => {
	if (event.tag === PERIODIC_SYNC_TAG)
		event.waitUntil(cleanupExpiredCache())

})

self.addEventListener('fetch', event => {
	const { request } = event
	for (const route of routes)
		if (route.condition({ event, request, url: new URL(request.url) })) {
			const handlerResult = route.handler({ event, request, url: new URL(request.url) })
			if (handlerResult) {
				const finalResponsePromise = Promise.resolve(handlerResult).catch(error => {
					console.error(`[SW Fetch] Final fallback for ${request.url}:`, error)
					if (isNavigationReq(request))
						return caches.match('./offline.html')

					return new Response('', { status: 503, statusText: 'Service Unavailable' })
				})
				event.respondWith(finalResponsePromise)
				return
			}
			return
		}

})
