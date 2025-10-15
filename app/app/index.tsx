import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { Contact } from '../types/contact';
import { mockContacts } from '../data/mockContacts';
import { rankingContacts, extractSimpleHashtags, getAITags } from '../utils/aiRankingContacts';
import { initializeDatabase, getCachedContact } from '../utils/contactCache';

export default function Index() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([...mockContacts]);
  const [displayedContacts, setDisplayedContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasPermission, setHasPermission] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);

  useEffect(() => {
    // Initialize database on app load
    initializeDatabase().catch(error => {
      console.error('Failed to initialize database:', error);
    });
    
    requestStoreContactsPermission();
    // Handle fetching and processing contacts
    if (hasPermission) {
      fetchProcessContacts();
      setDisplayedContacts(rankingContacts(contacts, ''));
    }
  }, []);

  const fetchProcessContacts = async () => {
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
    });
    const formattedContacts: Contact[] = await Promise.all(
      data.map(async (contact) => {
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
            // No cache, extract hashtags and cache them
            formattedContact.hashtags = extractSimpleHashtags(formattedContact);
            console.log(`Generated hashtags for ${formattedContact.name}: ${formattedContact.hashtags?.join(', ')}`);
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
  };

  const requestStoreContactsPermission = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        Alert.alert(
          'Permission Granted',
          'Contact permissions have been granted. Loading your contacts.'
        );
      } else {
        Alert.alert(
          'Permission Denied',
          'Contact permissions were denied. Using pre-loaded contacts.'
        );
      }
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      Alert.alert(
        'Error',
        'Failed to request contact permissions. Using pre-loaded contacts.'
      );
    }
  };

  const handleSearch = () => {
    if (firstLoad) {
      setFirstLoad(false);
    }
    const rankedContacts = rankingContacts(contacts, searchQuery);
    setDisplayedContacts(rankedContacts);
  };

  const handleContactPress = (contact: Contact) => {
    router.push({
      pathname: '/contact-detail',
      params: { contact: JSON.stringify(contact) }
    });
  };

  const handleGraphViewPress = () => {
    router.push('/graph-view');
  };

  const renderContactItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity 
      style={styles.contactCard}
      onPress={() => handleContactPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.contactAvatar}>
        <Text style={styles.contactAvatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
        {item.email && <Text style={styles.contactEmail}>{item.email}</Text>}
      </View>
    </TouchableOpacity>
  );

  return firstLoad ? (
      <View style={styles.firstLoadContainer}>
        <View style={styles.firstLoadContent}>
          <TextInput
            style={styles.firstLoadSearchInput}
            placeholder="Search contacts..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              handleSearch();
            }}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.firstLoadSearchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.graphViewButton} onPress={handleGraphViewPress}>
            <Text style={styles.graphViewButtonText}>🌐 View Graph</Text>
          </TouchableOpacity>
          <Text style={styles.firstLoadText}>
            Use AI to navigate your phone book
          </Text>
        </View>
      </View>
    ) : (
      <View style={styles.container}>
        {/* Search Bar at Top */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              handleSearch();
            }}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.graphButton} onPress={handleGraphViewPress}>
            <Text style={styles.graphButtonText}>🌐</Text>
          </TouchableOpacity>
        </View>
        {/* Contact List */}
        <FlatList
          data={displayedContacts}
          renderItem={renderContactItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {displayedContacts.length} contact{displayedContacts.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    )};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  firstLoadContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  firstLoadContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '85%',
    maxWidth: 400,
  },
  firstLoadSearchInput: {
    width: '100%',
    height: 48,
    backgroundColor: '#f0f0f0',
    borderRadius: 24,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#000',
    marginBottom: 16,
  },
  firstLoadSearchButton: {
    width: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    marginBottom: 20,
  },
  firstLoadText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  contactCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  contactInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  contactEmail: {
    fontSize: 13,
    color: '#999',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
  },
  footer: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 34 : 12, // Account for iPhone home indicator
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#f0f0f0',
    borderRadius: 24,
    paddingHorizontal: 20,
    fontSize: 16,
    marginRight: 12,
    color: '#000',
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  graphViewButton: {
    width: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 24,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    marginBottom: 20,
  },
  graphViewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  graphButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 24,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    marginLeft: 8,
  },
  graphButtonText: {
    fontSize: 20,
  },
});
