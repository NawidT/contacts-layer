import { Contact } from '../types/contact';
import nlp from 'compromise';
import { getCachedContact, setCachedContact } from './contactCache';

/**
 * AI-based contact ranking algorithm (mock implementation using alphabetical ordering)
 * In the future, this will use AI to rank contacts based on relevance to the search query
 * 
 * @param contacts - Array of contacts to rank
 * @param searchQuery - The search query to rank against
 * @returns Ranked array of contacts
 */
export function rankingContacts(contacts: Contact[], searchQuery: string): Contact[] {
  if (!searchQuery.trim()) {
    // If no search query, return all contacts in alphabetical order
    return [...contacts]
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  // Filter contacts that match the search query (name, phone, or email)
  const filteredContacts = contacts.filter(contact => {
    const query = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.phoneNumber.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.hashtags?.some(hashtag => hashtag.toLowerCase().includes(query)) ||
      contact.summary?.toLowerCase().includes(query)
    );
  });

  // Mock AI ranking: Sort alphabetically for now
  // TODO: Replace with actual AI ranking algorithm
  const rankedContacts = filteredContacts.sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  // Return max 20 contacts
  return rankedContacts;
}

/**
 * Extract hashtags from contact using OpenAI API with SQLite caching
 * Works in React Native by using direct fetch calls instead of LangChain
 * 
 * @param contact - Contact to extract hashtags from
 * @returns Contact with hashtags populated
 */
export async function getAITags(contact: Contact): Promise<Contact> {
  // Return cached hashtags if already in memory
  if (contact.hashtags && contact.hashtags.length > 0) {
    return contact;
  }

  // Check SQLite cache first
  try {
    const cachedData = await getCachedContact(contact.name, contact.phoneNumber);
    if (cachedData?.hashtags && cachedData.hashtags.length > 0) {
      console.log(`Using cached hashtags for ${contact.name}`);
      contact.hashtags = cachedData.hashtags;
      if (cachedData.summary) {
        contact.summary = cachedData.summary;
      }
      return contact;
    }
  } catch (error) {
    console.error('Error checking cache for hashtags:', error);
  }

  // Check if API key is available
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    console.log('No OpenAI API key found, using fallback hashtag extraction');
    contact.hashtags = extractSimpleHashtags(contact);
    
    // Cache the fallback hashtags
    try {
      await setCachedContact(contact.name, contact.phoneNumber, {
        hashtags: contact.hashtags,
        summary: contact.summary,
      });
    } catch (error) {
      console.error('Error caching fallback hashtags:', error);
    }
    
    return contact;
  }

  try {
    const nameParts = contact.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const prompt = `Given a contact name, extract relevant hashtags, focusing on:
- Company names (e.g., #google, #meta, #airbnb)
- Job roles (e.g., #engineer, #pm, #designer)
- Places or events (e.g., #conference, #hackathon, #ycombinator)
- Professional or personal context (e.g., #friend, #startup, #linkedin)
- Where they're from based off area code in their phone number e.g. 404 is #atlanta

Return 2-6 descriptive hashtags (just the hashtags, comma-separated), all lowercase, based on the following contact:

Contact name: ${firstName} ${lastName}
Contact phone number: ${contact.phoneNumber || ''}
Contact email: ${contact.email || ''}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.choices[0]?.message?.content || '';
    
    // Parse comma-separated hashtags
    contact.hashtags = result
      .split(',')
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0);

    console.log(`Hashtags for ${contact.name}:`, contact.hashtags);
    
    // Cache the AI-generated hashtags
    try {
      await setCachedContact(contact.name, contact.phoneNumber, {
        hashtags: contact.hashtags,
        summary: contact.summary,
      });
    } catch (error) {
      console.error('Error caching AI hashtags:', error);
    }
    
    return contact;
  } catch (error) {
    console.error('Error extracting hashtags with AI:', error);
    // Fallback to simple extraction
    contact.hashtags = extractSimpleHashtags(contact);
    
    // Cache the fallback hashtags
    try {
      await setCachedContact(contact.name, contact.phoneNumber, {
        hashtags: contact.hashtags,
        summary: contact.summary,
      });
    } catch (error) {
      console.error('Error caching fallback hashtags:', error);
    }
    
    return contact;
  }
}

/**
 * Generate AI summary for a contact using OpenAI API with SQLite caching
 * 
 * @param contact - Contact to generate summary for
 * @returns Contact with summary populated
 */
export async function getAISummary(contact: Contact): Promise<Contact> {
  // Return cached summary if already in memory
  if (contact.summary && contact.summary.trim().length > 0) {
    return contact;
  }

  // Check SQLite cache first
  try {
    const cachedData = await getCachedContact(contact.name, contact.phoneNumber);
    if (cachedData?.summary && cachedData.summary.trim().length > 0) {
      console.log(`Using cached summary for ${contact.name}`);
      contact.summary = cachedData.summary;
      if (cachedData.hashtags) {
        contact.hashtags = cachedData.hashtags;
      }
      return contact;
    }
  } catch (error) {
    console.error('Error checking cache for summary:', error);
  }

  // Check if API key is available
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    console.log('No OpenAI API key found, skipping summary generation');
    return contact;
  }

  try {
    const prompt = `Generate a brief, one-line summary (max 80 characters) for this contact. Focus on their role, company, or relationship context if available:

Contact name: ${contact.name}
Phone number: ${contact.phoneNumber || ''}
Email: ${contact.email || ''}
Company: ${contact.company || ''}

Return only the summary text, nothing else.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    contact.summary = data.choices[0]?.message?.content?.trim() || '';

    console.log(`Generated summary for ${contact.name}: ${contact.summary}`);
    
    // Cache the AI-generated summary
    try {
      await setCachedContact(contact.name, contact.phoneNumber, {
        summary: contact.summary,
        hashtags: contact.hashtags,
      });
    } catch (error) {
      console.error('Error caching AI summary:', error);
    }
    
    return contact;
  } catch (error) {
    console.error('Error generating summary with AI:', error);
    return contact;
  }
}

/**
 * Enhanced hashtag extraction using NLP (compromise library)
 * Generously extracts hashtags from name, company, summary, and phone area code
 * Uses entity recognition and keyword extraction for comprehensive tagging
 */
export function extractSimpleHashtags(contact: Contact, debug: boolean = false): string[] {
  const hashtagSet = new Set<string>();
  
  // Combine all available text for analysis
  const textParts = [
    contact.name,
    contact.company || '',
    contact.summary || '',
  ].filter(part => part && part.trim());
  
  const combinedText = textParts.join('. ');
  
  if (combinedText.trim()) {
    const doc = nlp(combinedText);
    
    // Extract organizations/companies
    const orgs = doc.organizations().out('array');
    orgs.forEach((org: string) => {
      const cleaned = org.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (cleaned) hashtagSet.add(cleaned);
    });
    
    // Extract places
    const places = doc.places().out('array');
    places.forEach((place: string) => {
      const cleaned = place.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (cleaned) {
        hashtagSet.add(cleaned.replace(/\s+/g, '_'));
        debug && console.log('Added place: ', cleaned);
      }
    });
    
    // Prepare name parts for filtering
    const nameLower = contact.name.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const nameWords = nameLower.split(/\s+/);
    
    // Extract topics (nouns) - be generous
    const topics = doc.topics().out('array');
    topics.forEach((topic: string) => {
      const cleaned = topic.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const cleanedWords = cleaned.split(/\s+/);
      
      // Check if this topic is the person's name or contains their name parts
      const isPartOfName = cleaned === nameLower || 
                          nameWords.some(nameWord => cleaned.includes(nameWord)) ||
                          cleanedWords.every(word => nameWords.includes(word));
      
      if (cleaned && cleaned.length > 2 && !isPartOfName) {
        hashtagSet.add(cleaned.replace(/\s+/g, '_'));
        debug && console.log('Added topic: ', cleaned);
      }
    });
    
    // Extract nouns for additional keywords
    const nouns = doc.nouns().out('array');
    nouns.forEach((noun: string) => {
      const cleaned = noun.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const cleanedWords = cleaned.split(/\s+/);
      
      // Filter out very common/generic words
      const skipWords = ['contact', 'person', 'thing', 'someone', 'something', 'time', 'way'];
      
      // Check if this noun is the person's name or contains their name parts
      const isPartOfName = cleaned === nameLower || 
                          nameWords.some(nameWord => cleaned.includes(nameWord)) ||
                          cleanedWords.every(word => nameWords.includes(word));
      
      if (cleaned && cleaned.length > 2 && !skipWords.includes(cleaned) && !isPartOfName) {
        hashtagSet.add(cleaned.replace(/\s+/g, '_'));
        debug && console.log('Added noun: ', cleaned);
      }
    });
    
    // Extract verbs (actions) for context
    const verbs = doc.verbs().out('array');
    verbs.forEach((verb: string) => {
      const cleaned = verb.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const skipVerbs = ['is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had'];
      if (cleaned && cleaned.length > 3 && !skipVerbs.includes(cleaned)) {
        hashtagSet.add(cleaned.replace(/\s+/g, '_'));
        debug && console.log('Added verb: ', cleaned);
      }
    });
    
    // Extract adjectives (descriptors)
    const adjectives = doc.adjectives().out('array');
    adjectives.forEach((adj: string) => {
      const cleaned = adj.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (cleaned && cleaned.length > 3) {
        hashtagSet.add(cleaned);
        debug && console.log('Added adjective: ', cleaned);
      }
    });
  }
  
  // Add company as a hashtag if provided
  if (contact.company) {
    const companyClean = contact.company.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (companyClean) {
      hashtagSet.add(companyClean.replace(/\s+/g, '_'));
      debug && console.log('Added company: ', companyClean);
    }
  }
  
  // Pattern matching for common tech companies and roles
  const combinedLower = combinedText.toLowerCase();
  
  const techCompanies = [
    'google', 'meta', 'facebook', 'apple', 'amazon', 'microsoft', 'netflix', 
    'tesla', 'stripe', 'airbnb', 'uber', 'lyft', 'aws', 'openai', 'anthropic',
    'yc', 'y combinator', 'ycombinator', 'techstars', 'sequoia', 'a16z',
    'andreessen', 'twitter', 'x corp', 'linkedin', 'github', 'gitlab',
    'shopify', 'spotify', 'slack', 'zoom', 'figma', 'notion', 'airtable', 'gt'
  ];
  
  techCompanies.forEach(company => {
    if (combinedLower.includes(company)) {
      hashtagSet.add(company.replace(/\s+/g, '_'));
      debug && console.log('Added tech company: ', company);
    }
  });
  
  const roles = [
    'engineer', 'software engineer', 'swe', 'eng', 'developer', 'dev',
    'pm', 'product manager', 'designer', 'ux', 'ui', 'product designer',
    'recruiter', 'founder', 'cofounder', 'co-founder', 'ceo', 'cto', 'cfo',
    'vp', 'director', 'manager', 'lead', 'senior', 'junior', 'intern',
    'marketing', 'sales', 'business development', 'bd', 'data scientist',
    'ml engineer', 'devops', 'backend', 'frontend', 'fullstack', 'full stack'
  ];
  
  roles.forEach(role => {
    if (combinedLower.includes(role)) {
      hashtagSet.add(role.replace(/\s+/g, '_'));
      debug && console.log('Added role: ', role);
    }
  });
  
  // Common contexts and relationships
  const contexts = [
    'friend', 'colleague', 'coworker', 'mentor', 'mentee', 'advisor',
    'conference', 'hackathon', 'meetup', 'networking', 'startup', 'investor',
    'client', 'customer', 'partner', 'vendor', 'contractor', 'freelancer',
    'school', 'university', 'college', 'classmate', 'alumni', 'professor',
    'family', 'neighbor', 'roommate'
  ];
  
  contexts.forEach(context => {
    if (combinedLower.includes(context)) {
      hashtagSet.add(context);
      debug && console.log('Added context: ', context);
    }
  });
  
  // Extract area code and map to location
  if (contact.phoneNumber) {
    const areaCode = contact.phoneNumber.replace(/\D/g, '').slice(0, 3);
    const areaCodeMap: { [key: string]: string } = {
      '404': 'atlanta',
      '470': 'atlanta',
      '678': 'atlanta',
      '212': 'nyc',
      '646': 'nyc',
      '917': 'nyc',
      '718': 'nyc',
      '415': 'sf',
      '628': 'sf',
      '650': 'bayarea',
      '510': 'bayarea',
      '408': 'bayarea',
      '669': 'bayarea',
      '617': 'boston',
      '857': 'boston',
      '310': 'la',
      '424': 'la',
      '213': 'la',
      '323': 'la',
      '206': 'seattle',
      '425': 'seattle',
      '512': 'austin',
      '737': 'austin',
      '312': 'chicago',
      '773': 'chicago',
      '720': 'denver',
      '303': 'denver',
      '305': 'miami',
      '786': 'miami',
      '202': 'dc',
      '571': 'dc',
      '703': 'dc',
    };
    
    if (areaCodeMap[areaCode]) {
      hashtagSet.add(areaCodeMap[areaCode]);
      debug && console.log('Added area code: ', areaCodeMap[areaCode]);
    }
  }
  
  // Convert set to array and add # prefix
  const hashtags = Array.from(hashtagSet)
    .filter(tag => tag.length > 1) // Remove single character tags
    .map(tag => `#${tag}`);
  
  // If we still don't have any hashtags, add a default
  return hashtags.length > 0 ? hashtags : [];
}


