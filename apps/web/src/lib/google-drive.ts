/**
 * Google Drive API Client Helper
 * Pure browser-native implementation using Web Crypto API (SubtleCrypto)
 * for signing RS256 JWTs with Google Service Account keys.
 */

export interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri?: string;
  token_uri?: string;
}

export interface DriveVerificationResult {
  ok: boolean;
  message: string;
  driveName?: string;
  rootFolderName?: string;
  error?: string;
}

/**
 * Validates and parses service account JSON string.
 */
export function parseServiceAccountKey(rawJson: string): ServiceAccountKey {
  const parsed = JSON.parse(rawJson);
  if (parsed.type !== "service_account" || !parsed.client_email || !parsed.private_key) {
    throw new Error("Invalid Service Account JSON: missing type, client_email, or private_key.");
  }
  return parsed as ServiceAccountKey;
}

/**
 * Converts a base64url string to/from ArrayBuffer.
 */
function base64urlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function stringToBase64Url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Converts PEM formatted RSA private key to binary PKCS#8 Uint8Array.
 */
function pemToBinary(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN[ A-Z0-9_-]+-----/g, "")
    .replace(/-----END[ A-Z0-9_-]+-----/g, "")
    .replace(/\s+/g, "");
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Exchanges a Service Account key for an ephemeral Google OAuth2 access token.
 */
export async function getGoogleDriveAccessToken(key: ServiceAccountKey): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto API is only available in a browser environment.");
  }

  const binaryKey = pemToBinary(key.private_key);
  const keyBuffer = binaryKey.buffer.slice(
    binaryKey.byteOffset,
    binaryKey.byteOffset + binaryKey.byteLength,
  ) as ArrayBuffer;
  const cryptoKey = await window.crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsignedToken = `${stringToBase64Url(JSON.stringify(header))}.${stringToBase64Url(
    JSON.stringify(claimSet),
  )}`;

  const encoder = new TextEncoder();
  const signature = await window.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken),
  );

  const signedJwt = `${unsignedToken}.${base64urlEncode(signature)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      tokenData.error_description || tokenData.error || "Failed to obtain OAuth2 token from Google.",
    );
  }

  return tokenData.access_token as string;
}

/**
 * Validates Google Drive connection, checking the Shared Drive and Root Folder.
 */
export async function testGoogleDriveConnection(
  rawJson: string,
  sharedDriveId?: string,
  rootFolderId?: string,
): Promise<DriveVerificationResult> {
  try {
    const key = parseServiceAccountKey(rawJson);
    const token = await getGoogleDriveAccessToken(key);

    let driveName = "";
    if (sharedDriveId && sharedDriveId.trim()) {
      const sDriveRes = await fetch(
        `https://www.googleapis.com/drive/v3/drives/${encodeURIComponent(sharedDriveId.trim())}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!sDriveRes.ok) {
        const errJson = await sDriveRes.json().catch(() => ({}));
        throw new Error(
          `Shared Drive (${sharedDriveId}) access error: ${errJson.error?.message || sDriveRes.statusText}. Please ensure the service account (${key.client_email}) is added as Content Manager in that Shared Drive.`,
        );
      }
      const sDriveData = await sDriveRes.json();
      driveName = sDriveData.name ?? sharedDriveId;
    }

    let rootFolderName = "";
    if (rootFolderId && rootFolderId.trim()) {
      const folderRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          rootFolderId.trim(),
        )}?supportsAllDrives=true&fields=id,name,mimeType`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!folderRes.ok) {
        const errJson = await folderRes.json().catch(() => ({}));
        throw new Error(
          `Root Folder (${rootFolderId}) access error: ${errJson.error?.message || folderRes.statusText}.`,
        );
      }
      const folderData = await folderRes.json();
      rootFolderName = folderData.name ?? rootFolderId;
    }

    return {
      ok: true,
      message: `Verified: Connected as ${key.client_email}${driveName ? ` to Shared Drive "${driveName}"` : ""}${rootFolderName ? ` (folder: "${rootFolderName}")` : ""}.`,
      driveName,
      rootFolderName,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Connection failed.",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Uploads a file to Google Drive using multipart upload.
 */
export async function uploadFileToGoogleDrive(
  file: File,
  token: string,
  parentFolderId: string,
): Promise<{ id: string; name: string; webViewLink: string; sizeBytes: number; mimeType: string }> {
  const metadata = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    parents: [parentFolderId],
  };

  const boundary = `-------314159265358979323846`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const fileBytes = await file.arrayBuffer();

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata,
  )}${delimiter}Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;

  const encoder = new TextEncoder();
  const preBuffer = encoder.encode(metadataPart);
  const postBuffer = encoder.encode(closeDelimiter);

  const fullPayload = new Uint8Array(preBuffer.length + fileBytes.byteLength + postBuffer.length);
  fullPayload.set(preBuffer, 0);
  fullPayload.set(new Uint8Array(fileBytes), preBuffer.length);
  fullPayload.set(postBuffer, preBuffer.length + fileBytes.byteLength);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,webViewLink,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: fullPayload,
    },
  );

  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || "Failed to upload file to Google Drive.");
  }

  return {
    id: data.id,
    name: data.name || file.name,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    sizeBytes: file.size,
    mimeType: file.type || data.mimeType || "application/octet-stream",
  };
}
