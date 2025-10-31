import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Contact } from '../types/contact';
import { rankingContacts } from '../utils/aiRankingContacts';
import { useContacts } from './_layout';

export default function Index() {
  const router = useRouter();
  const { contacts, isLoading } = useContacts();
  const [displayedContacts, setDisplayedContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [firstLoad, setFirstLoad] = useState(true);

  useEffect(() => {
    if (contacts.length > 0) {
      setDisplayedContacts(rankingContacts(contacts, ''));
    }
  }, [contacts]);

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

  // Show loading indicator while contacts are being loaded
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading contacts...</Text>
      </View>
    );
  }

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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
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
