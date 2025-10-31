import React, { createContext, useContext, useState, useEffect } from 'react';
import { Stack } from "expo-router";
import { LogBox, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Contacts from 'expo-contacts';
import { Contact } from '../types/contact';
import { mockContacts } from '../data/mockContacts';
import { extractSimpleHashtags } from '../utils/aiRankingContacts';
import { initializeDatabase, getCachedContact, getCacheStats, testLLM } from '../utils/contactCache';
import { Platform } from 'react-native';

// Optionally ignore specific warnings during development
LogBox.ignoreAllLogs(false);

// Create the Contacts Context
interface ContactsContextType {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  hasPermission: boolean;
  isLoading: boolean;
  refreshContacts: () => Promise<void>;
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

// Custom hook to use the contacts context
export function useContacts() {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error('useContacts must be used within a ContactsProvider');
  }
  return context;
}

export default function RootLayout() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  /** Handles getting DB and permissions */
  const initializeApp = async () => {
    // Initialize database
    try {
      await initializeDatabase();
      console.log('Database initialized successfully');
      
      // Expose database to console for debugging (web only)
      if (Platform.OS === 'web') {
        const SQLite = require('expo-sqlite');
        const db = await SQLite.openDatabaseAsync('contactsCache.db');
        (window as any).__expo_sqlite_db = db;
        (window as any).queryDB = async (sql: string) => {
          try {
            const result = await db.getAllAsync(sql);
            console.log(`📊 Query: ${sql}`);
            console.log(`Found ${result.length} rows:`);
            console.table(result);
            return result;
          } catch (error) {
            console.error('Query error:', error);
            return [];
          }
        };
        console.log('✅ Database exposed to console. Use: queryDB("SELECT * FROM contact_cache")');
        (window as any).testLLM = async (usermsg: string) => {
          return await testLLM(usermsg);
        };
        console.log('✅ LLM exposed to console. Use: testLLM("Hello, how are you?")');
      }
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }

    // Request permissions
    await requestContactsPermission();

    // get cache stats
    const stats = await getCacheStats();
    console.log('Cache stats: ', stats);
  };

  const requestContactsPermission = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        await fetchAndProcessContacts();
      } else {
        setHasPermission(false);
        // Use mock contacts as fallback
        setContacts(mockContacts);
        setIsLoading(false);
        Alert.alert(
          'Permission Denied',
          'Contact permissions were denied. Using sample contacts.'
        );
      }
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      setContacts(mockContacts);
      setIsLoading(false);
      Alert.alert(
        'Error',
        'Failed to request contact permissions. Using sample contacts.'
      );
    }
  };

  const fetchAndProcessContacts = async () => {
    setIsLoading(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.ID],
      });
      const limitedData = data.slice(0, 40);

      const formattedContacts: Contact[] = await Promise.all(
        limitedData.map(async (contact, index) => {
          const formattedContact: Contact = {
            id: contact.id,
            name: contact.name || 'Unknown',
            phoneNumber: contact.phoneNumbers?.[0]?.number || '',
            email: contact.emails?.[0]?.email,
          };

          // Try to get cached data first
          try {
            const cachedData = await getCachedContact(
              formattedContact.name,
              formattedContact.phoneNumber
            );

            if (cachedData) {
              formattedContact.hashtags = cachedData.hashtags;
              formattedContact.summary = cachedData.summary;
              console.log(`Loaded cached data for ${formattedContact.name}`);
            } else {
              // No cache, extract hashtags
              formattedContact.hashtags = extractSimpleHashtags(formattedContact);
              formattedContact.hashtags.length > 0 && console.log(`Generated hashtags for ${formattedContact.name}: ${formattedContact.hashtags?.join(', ')}`);
            }
          } catch (error) {
            console.error(`Error processing contact ${formattedContact.name}:`, error);
            // Fallback to simple extraction
            formattedContact.hashtags = extractSimpleHashtags(formattedContact);
          }
          return formattedContact;
        })
      );

      setContacts(formattedContacts);
      console.log(`Loaded ${formattedContacts.length} contacts`);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      setContacts(mockContacts);
      Alert.alert('Error', 'Failed to load contacts. Using sample contacts.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshContacts = async () => {
    if (hasPermission) {
      await fetchAndProcessContacts();
    }
  };

  const contextValue: ContactsContextType = {
    contacts,
    setContacts,
    hasPermission,
    isLoading,
    refreshContacts,
  };

  return (
    <ContactsContext.Provider value={contextValue}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="contact-detail" options={{ headerShown: false }} />
          <Stack.Screen name="graph-view" options={{ headerShown: false }} />
        </Stack>
      </GestureHandlerRootView>
    </ContactsContext.Provider>
  );
}
