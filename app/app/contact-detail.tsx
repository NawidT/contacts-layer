import React, { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Contact } from '../types/contact';
import { setCachedContact } from '../utils/db';

export default function ContactDetail() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRefs = {
    name: useRef<View>(null),
    company: useRef<View>(null),
    summary: useRef<View>(null),
    hashtags: useRef<View>(null),
  };
  
  // Parse the contact data from params
  const initialContact = params.contact ? JSON.parse(params.contact as string) : null;
  
  const [name, setName] = useState(initialContact?.name || '');
  const [company, setCompany] = useState(initialContact?.company || '');
  const [imageUrl, setImageUrl] = useState(initialContact?.imageUrl || '');
  const [summary, setSummary] = useState(initialContact?.summary || '');
  const [hashtagsText, setHashtagsText] = useState(
    initialContact?.hashtags?.join(', ') || ''
  );

  const handleSave = async () => {
    try {
      // Save to SQLite cache
      const phoneNumber = initialContact?.phoneNumber || '';
      const hashtags = hashtagsText
        .split(',')
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag)
        .map((tag: string) => tag.startsWith('#') ? tag : `#${tag}`);

      await setCachedContact(name, phoneNumber, {
        summary: summary || undefined,
        hashtags: hashtags.length > 0 ? hashtags : undefined,
      });

      console.log(`Saved contact data for ${name} to cache`);
      Keyboard.dismiss();
      router.back();
    } catch (error) {
      console.error('Error saving contact data:', error);
      Alert.alert('Error', 'Failed to save contact data');
    }
  };

  const getInitials = () => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  const scrollToInput = (inputRef: React.RefObject<View | null>) => {
    setTimeout(() => {
      if (inputRef.current && scrollViewRef.current) {
        inputRef.current.measureLayout(
          scrollViewRef.current as any,
          (x, y, width, height) => {
            scrollViewRef.current?.scrollTo({
              y: y - 20,
              animated: true,
            });
          },
          () => {}
        );
      }
    }, 100);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Details</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </View>
          )}
        </View>

        {/* Name Field */}
        <View style={styles.fieldContainer} ref={inputRefs.name}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter name..."
            placeholderTextColor="#999"
            onFocus={() => scrollToInput(inputRefs.name)}
          />
        </View>

        {/* Company Field */}
        <View style={styles.fieldContainer} ref={inputRefs.company}>
          <Text style={styles.fieldLabel}>Company</Text>
          <TextInput
            style={styles.input}
            value={company}
            onChangeText={setCompany}
            placeholder="Enter company..."
            placeholderTextColor="#999"
            onFocus={() => scrollToInput(inputRefs.company)}
          />
        </View>

        {/* Summary Field */}
        <View style={styles.fieldContainer} ref={inputRefs.summary}>
          <Text style={styles.fieldLabel}>Summary</Text>
          <Text style={styles.fieldHelper}>Brief description or notes about this contact</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={summary}
            onChangeText={setSummary}
            placeholder="e.g., Met at Google conference, interested in AI startups..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            onFocus={() => scrollToInput(inputRefs.summary)}
          />
        </View>

        {/* Hashtags Field */}
        <View style={styles.fieldContainer} ref={inputRefs.hashtags}>
          <Text style={styles.fieldLabel}>Hashtags</Text>
          <Text style={styles.fieldHelper}>Separate hashtags with commas</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={hashtagsText}
            onChangeText={setHashtagsText}
            placeholder="Enter hashtags (e.g., friend, work, family)..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            onFocus={() => scrollToInput(inputRefs.hashtags)}
          />
        </View>

        {/* Display Hashtags as Pills */}
        {hashtagsText.trim() && (
          <View style={styles.hashtagsPreview}>
            <Text style={styles.previewLabel}>Preview:</Text>
            <View style={styles.hashtagsContainer}>
              {hashtagsText
                .split(',')
                .map((tag: string) => tag.trim())
                .filter((tag: string) => tag)
                .map((tag: string, index: number) => (
                  <View key={index} style={styles.hashtagPill}>
                    <Text style={styles.hashtagText}>#{tag}</Text>
                  </View>
                ))}
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Extra padding at bottom for keyboard
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  fieldHelper: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hashtagsPreview: {
    marginTop: 8,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hashtagPill: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  hashtagText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

