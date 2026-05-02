const DPOP_JWK_STORAGE_KEY = 'dpop_private_jwk_v1'

function toBase64Url(bytes) {
  let binary = ''
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  for (let i = 0; i < arr.length; i += 1) {
    binary += String.fromCharCode(arr[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function sha256Base64Url(input) {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toBase64Url(new Uint8Array(digest))
}

function createUuid() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function getOrCreateDpopKeyPair() {
  const saved = sessionStorage.getItem(DPOP_JWK_STORAGE_KEY)
  if (saved) {
    const privateJwk = JSON.parse(saved)
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      privateJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    )
    const { d, ...publicJwk } = privateJwk
    return { privateKey, publicJwk }
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  sessionStorage.setItem(DPOP_JWK_STORAGE_KEY, JSON.stringify(privateJwk))
  return { privateKey: keyPair.privateKey, publicJwk }
}

function encodeJsonPart(obj) {
  const json = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(json)
  return toBase64Url(bytes)
}

export async function createDpopProof({ htu, htm, accessToken }) {
  if (!accessToken) {
    throw new Error('Missing access token for DPoP proof')
  }

  const { privateKey, publicJwk } = await getOrCreateDpopKeyPair()
  const iat = Math.floor(Date.now() / 1000)
  const ath = await sha256Base64Url(accessToken)

  const header = {
    typ: 'dpop+jwt',
    alg: 'ES256',
    jwk: publicJwk,
  }

  const payload = {
    jti: createUuid(),
    htm: htm.toUpperCase(),
    htu,
    iat,
    ath,
  }

  const encodedHeader = encodeJsonPart(header)
  const encodedPayload = encodeJsonPart(payload)
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    new TextEncoder().encode(signingInput)
  )
  const encodedSignature = toBase64Url(new Uint8Array(signature))

  return `${signingInput}.${encodedSignature}`
}
