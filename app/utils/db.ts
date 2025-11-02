import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

/**
 * SQLite-based cache for storing contact summaries and hashtags
 * Uses name + phoneNumber as the composite key
 */

let db: SQLite.SQLiteDatabase | null = null;


/**
 * Initialize the SQLite database and create the cache table if it doesn't exist
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Open or create the database
    db = await SQLite.openDatabaseAsync('contactsCache');
    
    // Create the cache table if it doesn't exist
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS contact_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        summary TEXT,
        hashtags TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(name, phone_number)
      );
    `);
    
    // Create an index on name and phone_number for faster lookups
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_name_phone 
      ON contact_cache(name, phone_number);
    `);
    
    console.log('Database initialized successfully');
    console.log('DB Path: ', db.databasePath);
    // print all elements in database
    
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Get the database instance, initializing it if necessary
 */
async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    await initializeDatabase();
  }
  return db!;
}

/**
 * Cache entry interface
 */
export interface CachedContactData {
  summary?: string;
  hashtags?: string[];
}

/** 
 * Get cached data for a contact
 * @param name - Contact name
 * @param phoneNumber - Contact phone number
 * @returns Cached data or null if not found
 */
export async function getCachedContact(
  name: string,
  phoneNumber: string
): Promise<CachedContactData | null> {
  try {
    const database = await getDatabase();
    
    const result = await database.getFirstAsync<{
      summary: string | null;
      hashtags: string | null;
    }>(
      'SELECT summary, hashtags FROM contact_cache WHERE name = ? AND phone_number = ?',
      [name, phoneNumber ]
    );

     // handle when no rows are returned
    if (!result) {
      console.log(`No cached data found for ${name} (${phoneNumber})`);
      return null;
    }

    return {
      summary: result.summary || undefined,
      hashtags: result.hashtags ? result.hashtags.split(",") : undefined,
    };
  } catch (error) {
    console.error('Error getting cached contact:', error);
    return null;
  }
}

/**
 * Store or update contact data in the cache
 * @param name - Contact name
 * @param phoneNumber - Contact phone number
 * @param data - Contact data to cache (summary and/or hashtags)
 */
export async function setCachedContact(
  name: string,
  phoneNumber: string,
  data: CachedContactData
): Promise<void> {
  try {
    const database = await getDatabase();
    const now = Date.now();
    const hashtagsList = data.hashtags ? data.hashtags.join(',') : "";
    
    // Use INSERT OR REPLACE to handle both inserts and updates
    await database.runAsync(
      `INSERT OR REPLACE INTO contact_cache 
       (name, phone_number, summary, hashtags, created_at, updated_at) 
       VALUES ($name, $phoneNumber, $summary, $hashtagsList, $now, $now)`,
      { 
        $name: name, 
        $phoneNumber: phoneNumber, 
        $summary: data.summary || null, 
        $hashtagsList: hashtagsList, 
        $now: now }
    );
    
    console.log(`Cached data for ${name} (${phoneNumber ? phoneNumber : 'no phone number'})`);
  } catch (error) {
    console.error('Error setting cached contact:', error);
    throw error;
  }
}

/**
 * Check if a contact has cached data
 * @param name - Contact name
 * @param phoneNumber - Contact phone number
 * @returns True if cached data exists
 */
export async function hasCachedContact(
  name: string,
  phoneNumber: string
): Promise<boolean> {
  try {
    const database = await getDatabase();
    
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM contact_cache WHERE name = ? AND phone_number = ?',
      [name, phoneNumber]
    );
    
    return (result?.count || 0) > 0;
  } catch (error) {
    console.error('Error checking cached contact:', error);
    return false;
  }
}

/**
 * Delete a specific contact from the cache
 * @param name - Contact name
 * @param phoneNumber - Contact phone number
 */
export async function deleteCachedContact(
  name: string,
  phoneNumber: string
): Promise<void> {
  try {
    const database = await getDatabase();
    
    await database.runAsync(
      'DELETE FROM contact_cache WHERE name = ? AND phone_number = ?',
      [name, phoneNumber]
    );
    
    console.log(`Deleted cached data for ${name} (${phoneNumber})`);
  } catch (error) {
    console.error('Error deleting cached contact:', error);
    throw error;
  }
}

/**
 * Clear all cached contacts
 */
export async function clearCache(): Promise<void> {
  try {
    const database = await getDatabase();
    
    await database.runAsync('TRUNCATE TABLE contact_cache');
    
    console.log('Cache cleared successfully');
  } catch (error) {
    console.error('Error clearing cache:', error);
    throw error;
  }
}

/**
 * Get the number of cached contacts
 * @returns Number of cached contacts
 */
export async function getCacheSize(): Promise<number> {
  try {
    const database = await getDatabase();
    
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM contact_cache'
    );
    
    return result?.count || 0;
  } catch (error) {
    console.error('Error getting cache size:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 * @returns Object with cache statistics
 */
export async function getCacheStats(): Promise<{
  totalContacts: number;
  withSummary: number;
  withHashtags: number;
  databaseSizeBytes?: number;
}> {
  try {
    const database = await getDatabase();
    
    const total = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM contact_cache'
    );
    
    const withSummary = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM contact_cache WHERE summary IS NOT NULL'
    );
    
    const withHashtags = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM contact_cache WHERE hashtags IS NOT NULL'
    );
    
    // Try to get database file size
    let dbSize: number | undefined;
    try {
      const dbPath = database.databasePath;
      console.log('DB Path: ', dbPath);
      const fileInfo = new FileSystem.File(dbPath).info();
      if (fileInfo.exists) {
        dbSize = fileInfo.size;
      }
    } catch (e) {
      console.log('Could not get database file size:', e);
    }

    // show a sample of the table (first 5 rows)
    const sample = await database.getAllAsync<{ name: string, phone_number: string, summary: string, hashtags: string }>(
      'SELECT * FROM contact_cache LIMIT 5'
    );
    sample.forEach(row => {
      console.log(row);
    });

    return {
      totalContacts: total?.count || 0,
      withSummary: withSummary?.count || 0,
      withHashtags: withHashtags?.count || 0,
      databaseSizeBytes: dbSize,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      totalContacts: 0,
      withSummary: 0,
      withHashtags: 0,
    };
  }
}

/**
 * Delete old cache entries (older than specified days)
 * @param daysOld - Number of days to keep cache entries
 */
export async function deleteOldCacheEntries(daysOld: number = 30): Promise<number> {
  try {
    const database = await getDatabase();
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    const result = await database.runAsync(
      'DELETE FROM contact_cache WHERE updated_at < ?',
      [cutoffTime]
    );
    
    const deletedCount = result.changes;
    console.log(`Deleted ${deletedCount} old cache entries`);
    return deletedCount;
  } catch (error) {
    console.error('Error deleting old cache entries:', error);
    return 0;
  }
}

