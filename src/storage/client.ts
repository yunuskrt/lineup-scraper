import {
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { StorageEnv } from '@/config/env.schema.js';
import { CACHE_CONTROL } from '@/storage/keys.js';

// The bucket, as uploads and checks see it
export interface ObjectStore {
  checkBucket(): Promise<void>;
  hasObject(key: string): Promise<boolean>;
  putObject(
    key: string,
    body: Uint8Array,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<void>;
  countObjects(prefix: string): Promise<number>;
  listKeys(prefix: string): Promise<string[]>;
  // null when there's no such object
  readMetadata(key: string): Promise<Record<string, string> | null>;
}

// Only a 404 means missing; a 403 must not re-upload
export function isNotFound(error: unknown): boolean {
  const status = (error as { $metadata?: { httpStatusCode?: number } })
    ?.$metadata?.httpStatusCode;
  return status === 404;
}

export function createObjectStore(env: StorageEnv): ObjectStore {
  const client = new S3Client({
    region: env.AWS_REGION,
    endpoint: env.AWS_ENDPOINT_URL_S3,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    // Neon serves path-style only
    forcePathStyle: true,
    // Standard mode backs off on 503 SlowDown
    retryMode: 'standard',
    maxAttempts: 5,
  });
  const Bucket = env.STORAGE_BUCKET;

  async function listAll(Prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let ContinuationToken: string | undefined;
    do {
      const page = await client.send(
        new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken }),
      );
      for (const item of page.Contents ?? []) {
        if (item.Key) keys.push(item.Key);
      }
      ContinuationToken = page.NextContinuationToken;
    } while (ContinuationToken);
    return keys.toSorted();
  }

  return {
    async checkBucket() {
      await client.send(new HeadBucketCommand({ Bucket }));
    },
    async hasObject(Key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key }));
        return true;
      } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
      }
    },
    async putObject(Key, Body, ContentType, Metadata) {
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key,
          Body,
          ContentType,
          CacheControl: CACHE_CONTROL,
          Metadata,
        }),
      );
    },
    async countObjects(Prefix) {
      return (await listAll(Prefix)).length;
    },
    async listKeys(Prefix) {
      return listAll(Prefix);
    },
    async readMetadata(Key) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket, Key }));
        return head.Metadata ?? {};
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
  };
}
