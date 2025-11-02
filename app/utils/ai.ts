import { Contact } from '../types/contact';
import nlp from 'compromise';
import { ChatOpenAI } from '@langchain/openai';
import { prompt_get_hashtags } from './prompts';
import { z } from 'zod';
import { getCachedContact, setCachedContact } from './db';
// import { getCachedContact, setCachedContact } from './contactCache';


/**
 * 
 * 
 * create the model needed for openai api calls
 */
// function getOpenAIClient(): ChatOpenAI | OpenAI | null {
//   let llm : ChatOpenAI | OpenAI | null;
//   const apiKey = process.env.EXPO_OPENAI_API_KEY;
//   try {
//     llm = new ChatOpenAI({
//       model: 'gpt-4o-mini',
//       apiKey: apiKey
//     })
//   } catch (error) {
//     console.error('Error creating OpenAI client:', error);
//     llm = null;
//   }
//   // return llm;
//   if (!llm) {
//     if (!apiKey) {
//       throw new Error('EXPO_OPENAI_API_KEY is not set. Please create a .env file with your OpenAI API key.');
//     }
//     llm = new OpenAI({
//       apiKey: apiKey,
//       dangerouslyAllowBrowser: true
//     });
//   }
//   return llm;
// }

// const llm : ChatOpenAI | OpenAI | null = getOpenAIClient();
const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('EXPO_PUBLIC_OPENAI_API_KEY is not set. Please create a .env file with EXPO_PUBLIC_OPENAI_API_KEY=your_key');
}
const llm = new ChatOpenAI({
  model: 'gpt-4o-mini',
  apiKey: apiKey
});

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

  return rankedContacts;
}

/**
 * Extract hashtags from contact using OpenAI API with SQLite caching
 * Works in React Native by using direct fetch calls instead of LangChain
 * 
 * @param contact - Contact to extract hashtags from
 * @returns Contact with hashtags populated
 */
export async function ai_hashtags_generation(contact: Contact): Promise<string[]> {
  try { 
    const name = contact.name ? contact.name : '';
    const phoneNumber = contact.phoneNumber ? contact.phoneNumber : '';
    const email = contact.email ? contact.email : '';
    const summary = contact.summary ? contact.summary : '';
    const preExistingHashtags = contact.hashtags ? contact.hashtags : [];
    const prompt = prompt_get_hashtags(name, phoneNumber, email, summary, preExistingHashtags);
    const schema = z.object({
      hashtags: z.array(z.string()).describe('The hashtags for the contact'),
    });
    const llm_with_schema = llm.withStructuredOutput(schema);
    const response = await prompt.pipe(llm_with_schema).invoke({
      preExistingHashtags,
      name,
      phoneNumber,
      email,
      summary,
    });
    console.log('Hashtags generated');
    return response.hashtags;
  } catch (error) {
    console.error('Error generating hashtags:', error);
    return [];
  }
}

/**
 * Enhanced hashtag extraction using NLP (compromise library)
 * Generously extracts hashtags from name, company, summary, and phone area code
 * Uses entity recognition and keyword extraction for comprehensive tagging
 */
export function extract_simple_hashtags(contact: Contact, debug: boolean = false): string[] {
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

export async function extract_complex_hashtags(contact: Contact): Promise<string[]> {
  let cached_hashtags: string[] = [];
  // try to get cached hashtags
  try {
    const cached_contact = await getCachedContact(contact.name, contact.phoneNumber);
    if (cached_contact && cached_contact.hashtags) {
      cached_hashtags = cached_contact.hashtags;
    }
  } catch (error) {
    console.error('Error getting cached hashtags:', error);
  }
  // if cached hashtags are found, return them
  if (cached_hashtags.length > 0) {
    console.log(`Using cached hashtags for ${contact.name}: ${cached_hashtags.join(', ')}`);
    return cached_hashtags;
  } else { // if no cached hashtags are found, extract hashtags using NLP and AI
    let simple_hashtags: string[] = [];
    let ai_hashtags: string[] = [];
    try {
      simple_hashtags = extract_simple_hashtags(contact);
      if (simple_hashtags.length > 0) {
        contact.hashtags = simple_hashtags;
      }
      ai_hashtags = await ai_hashtags_generation(contact);
    }
    catch (error) {
      ai_hashtags = simple_hashtags;
    }
    setCachedContact(contact.name, contact.phoneNumber, { hashtags: ai_hashtags });
    console.log(`Cached hashtags for ${contact.name}: ${ai_hashtags.join(', ')}`);
    return ai_hashtags;
  }
}